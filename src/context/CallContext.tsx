import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** Real (non-simulated) camera/mic + WebRTC only exist on the web build for now — there's no native module wired up for it. */
export const callsSupported = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export type CallKind = 'dm' | 'group';
type CallStatus = 'incoming' | 'outgoing' | 'active';

interface CallInfo {
  callId: string;
  kind: CallKind;
  title: string;
  fromId: string;
  fromName: string;
  /** Every other participant expected in the call (not including me). */
  memberIds: string[];
  participantNames: Record<string, string>;
  status: CallStatus;
}

interface StartCallOptions {
  kind: CallKind;
  title: string;
  memberIds: string[];
  participantNames: Record<string, string>;
}

interface CallContextValue {
  call: CallInfo | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  micOn: boolean;
  cameraOn: boolean;
  error: string | null;
  startCall: (opts: StartCallOptions) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

function warn(label: string, error: { message: string } | null | undefined) {
  if (error) console.warn(`[calls] ${label}:`, error.message);
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const myName = ((user?.user_metadata as { full_name?: string } | undefined)?.full_name || user?.email || 'Someone') as string;

  const [call, setCall] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const callRef = useRef<CallInfo | null>(null);
  callRef.current = call;
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Personal inbox — invites (and cancellations of them) land here regardless of what screen I'm on.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`user-calls-${userId}`)
      .on('broadcast', { event: 'invite' }, (msg) => {
        if (callRef.current) return; // already on a call — silently miss it, like a busy line.
        const p = msg.payload as Omit<CallInfo, 'status'>;
        if (p.fromId === userId) return;
        setCall({ ...p, status: 'incoming' });
      })
      .on('broadcast', { event: 'cancel' }, (msg) => {
        const p = msg.payload as { callId: string };
        if (callRef.current?.callId === p.callId && callRef.current.status === 'incoming') setCall(null);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const teardownPeer = (peerId: string) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      pc.close();
      delete peersRef.current[peerId];
    }
    setRemoteStreams((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const createPeerConnection = (peerId: string, callId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        callChannelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: { callId, from: userId, to: peerId, kind: 'candidate', data: e.candidate.toJSON() },
        });
      }
    };
    pc.ontrack = (e) => {
      setRemoteStreams((prev) => ({ ...prev, [peerId]: e.streams[0] }));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') teardownPeer(peerId);
    };
    peersRef.current[peerId] = pc;
    return pc;
  };

  const connectToPeer = async (peerId: string, callId: string, initiator: boolean) => {
    if (peersRef.current[peerId] || !userId) return;
    const pc = createPeerConnection(peerId, callId);
    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      callChannelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { callId, from: userId, to: peerId, kind: 'offer', data: offer } });
    }
  };

  const handleSignal = async (payload: { callId: string; from: string; to: string; kind: 'offer' | 'answer' | 'candidate'; data: unknown }) => {
    if (payload.to !== userId) return;
    let pc = peersRef.current[payload.from];
    if (payload.kind === 'offer') {
      if (!pc) pc = createPeerConnection(payload.from, payload.callId);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.data as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      callChannelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { callId: payload.callId, from: userId, to: payload.from, kind: 'answer', data: answer } });
    } else if (payload.kind === 'answer') {
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.data as RTCSessionDescriptionInit));
    } else if (payload.kind === 'candidate' && pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.data as RTCIceCandidateInit));
      } catch {
        // A candidate that beat the offer/answer across the wire — safe to drop.
      }
    }
  };

  const joinCallRoom = (callId: string) => {
    if (!userId) return;
    const channel = supabase.channel(`call-${callId}`, { config: { presence: { key: userId } } });
    callChannelRef.current = channel;
    channel
      .on('broadcast', { event: 'signal' }, (msg) => handleSignal(msg.payload as Parameters<typeof handleSignal>[0]))
      .on('broadcast', { event: 'declined' }, (msg) => {
        const p = msg.payload as { callId: string };
        if (callRef.current?.callId === p.callId) {
          setError('The call was declined.');
          endCall();
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, { userId: string }[]>;
        const presentIds = Array.from(new Set(Object.values(state).flat().map((m) => m.userId))).filter((id) => id !== userId);
        for (const peerId of presentIds) {
          if (!peersRef.current[peerId]) connectToPeer(peerId, callId, userId < peerId);
        }
        for (const peerId of Object.keys(peersRef.current)) {
          if (!presentIds.includes(peerId)) teardownPeer(peerId);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ userId });
      });
  };

  const getLocalMedia = async (): Promise<MediaStream | null> => {
    if (!callsSupported) {
      setError("Video calls aren't available on this device yet — try the web app.");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } });
      setLocalStream(stream);
      return stream;
    } catch {
      setError('Camera and microphone access is needed for a video call.');
      return null;
    }
  };

  const startCall = async (opts: StartCallOptions) => {
    if (!userId || callRef.current) return;
    setError(null);
    if (!callsSupported) {
      setError("Video calls aren't available on this device yet — try the web app.");
      return;
    }
    const callId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const info: CallInfo = { callId, kind: opts.kind, title: opts.title, fromId: userId, fromName: myName, memberIds: opts.memberIds, participantNames: opts.participantNames, status: 'outgoing' };
    setCall(info);
    const stream = await getLocalMedia();
    if (!stream) {
      setCall(null);
      return;
    }
    for (const targetId of opts.memberIds) {
      supabase
        .channel(`user-calls-${targetId}`)
        .send({ type: 'broadcast', event: 'invite', payload: { callId, kind: opts.kind, title: opts.title, fromId: userId, fromName: myName, memberIds: opts.memberIds, participantNames: opts.participantNames } })
        .then((res) => warn('send invite', res === 'error' ? { message: 'broadcast failed' } : null));
    }
    joinCallRoom(callId);
  };

  const acceptCall = async () => {
    const info = callRef.current;
    if (!info || info.status !== 'incoming') return;
    setError(null);
    const stream = await getLocalMedia();
    if (!stream) return;
    setCall({ ...info, status: 'active' });
    joinCallRoom(info.callId);
  };

  const declineCall = () => {
    const info = callRef.current;
    if (!info) return;
    supabase
      .channel(`call-${info.callId}`)
      .send({ type: 'broadcast', event: 'declined', payload: { callId: info.callId, byId: userId } })
      .catch(() => {});
    setCall(null);
  };

  const endCall = () => {
    for (const id of Object.keys(peersRef.current)) teardownPeer(id);
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop();
    }
    setLocalStream(null);
    setRemoteStreams({});
    setCall(null);
    setMicOn(true);
    setCameraOn(true);
  };

  useEffect(() => {
    return () => endCall();
    // Cleanup only — runs when the provider itself unmounts (e.g. sign out).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    for (const track of stream.getAudioTracks()) track.enabled = next;
    setMicOn(next);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOn;
    for (const track of stream.getVideoTracks()) track.enabled = next;
    setCameraOn(next);
  };

  const value: CallContextValue = { call, localStream, remoteStreams, micOn, cameraOn, error, startCall, acceptCall, declineCall, endCall, toggleMic, toggleCamera };
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}
