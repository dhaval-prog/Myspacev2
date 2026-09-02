import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';
import { VideoTile } from './VideoTile';
import { useCall } from '../../context/CallContext';

const PHONE_ICON = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 2-2z';
const MIC_ON_ICON = 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 19v3';
const MIC_OFF_ICON = 'M9 5.2A3 3 0 0 1 15 6v6c0 .4-.06.77-.18 1.13M12 15a3 3 0 0 1-3-3M19 11a7 7 0 0 1-2.1 5M5 11a7 7 0 0 0 8.4 6.86M12 19v3M3 3l18 18';
const CAMERA_ON_ICON = 'M4 7h11v10H4zM15 10l5-3v10l-5-3';
const CAMERA_OFF_ICON = 'M4 7h6M4 7v10h11v-2M15 10l5-3v10l-5-3M3 3l18 18';

/** Global call UI — an incoming-call card, or the full in-call screen. Mounted once near the app root so a call can land regardless of which screen is open. */
export function CallOverlay() {
  const { call, localStream, remoteStreams, micOn, cameraOn, error, acceptCall, declineCall, endCall, toggleMic, toggleCamera } = useCall();

  if (!call) return null;

  if (call.status === 'incoming') {
    return (
      <Modal transparent animationType="fade" onRequestClose={declineCall}>
        <View style={styles.incomingWrap}>
          <View style={styles.incomingCard}>
            <View style={styles.incomingAvatar}>
              <Text style={styles.incomingInitial}>{call.fromName.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.incomingTitle}>{call.kind === 'group' ? call.title : call.fromName}</Text>
            <Text style={styles.incomingSub}>{call.kind === 'group' ? `Video call · ${call.fromName} is calling` : 'Incoming video call'}</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.incomingActions}>
              <View style={styles.incomingActionCol}>
                <Pressable onPress={declineCall} style={[styles.roundButton, styles.declineButton]} accessibilityRole="button" accessibilityLabel="Decline">
                  <Icon path={PHONE_ICON} color="#fff" size={20} strokeWidth={2} style={styles.hangupIcon} />
                </Pressable>
                <Text style={styles.actionLabel}>Decline</Text>
              </View>
              <View style={styles.incomingActionCol}>
                <Pressable onPress={acceptCall} style={[styles.roundButton, styles.acceptButton]} accessibilityRole="button" accessibilityLabel="Accept">
                  <Icon path={PHONE_ICON} color="#fff" size={20} strokeWidth={2} />
                </Pressable>
                <Text style={styles.actionLabel}>Accept</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const remoteIds = Object.keys(remoteStreams);
  const waitingNames = call.memberIds.filter((id) => !remoteIds.includes(id)).map((id) => call.participantNames[id] ?? 'Someone');

  return (
    <Modal transparent animationType="fade" onRequestClose={endCall}>
      <View style={styles.callWrap}>
        <Text style={styles.callTitle} numberOfLines={1}>
          {call.title}
        </Text>

        <View style={styles.grid}>
          {remoteIds.length === 0 ? (
            <View style={styles.waitingWrap}>
              <Text style={styles.waitingText}>{call.status === 'outgoing' ? `Calling ${waitingNames.join(', ')}…` : 'Connecting…'}</Text>
            </View>
          ) : (
            remoteIds.map((id) => (
              <View key={id} style={[styles.tile, remoteIds.length === 1 && styles.tileSingle]}>
                <VideoTile stream={remoteStreams[id]} />
                <Text style={styles.tileLabel}>{call.participantNames[id] ?? 'Someone'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.localTile}>
          <VideoTile stream={cameraOn ? localStream : null} muted mirrored />
          {!cameraOn && <View style={styles.localTileOff} />}
        </View>

        {error && <Text style={styles.errorBanner}>{error}</Text>}

        <View style={styles.controls}>
          <View style={styles.incomingActionCol}>
            <Pressable
              onPress={toggleMic}
              style={[styles.roundButton, styles.controlButton, !micOn && styles.controlButtonOff]}
              accessibilityRole="button"
              accessibilityLabel={micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              <Icon path={micOn ? MIC_ON_ICON : MIC_OFF_ICON} color="#fff" size={19} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.incomingActionCol}>
            <Pressable onPress={endCall} style={[styles.roundButton, styles.declineButton]} accessibilityRole="button" accessibilityLabel="End call">
              <Icon path={PHONE_ICON} color="#fff" size={20} strokeWidth={2} style={styles.hangupIcon} />
            </Pressable>
          </View>
          <View style={styles.incomingActionCol}>
            <Pressable
              onPress={toggleCamera}
              style={[styles.roundButton, styles.controlButton, !cameraOn && styles.controlButtonOff]}
              accessibilityRole="button"
              accessibilityLabel={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              <Icon path={cameraOn ? CAMERA_ON_ICON : CAMERA_OFF_ICON} color="#fff" size={19} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  incomingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.organic,
    backgroundColor: 'rgba(11,15,7,0.92)',
  },
  incomingCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing.xs,
  },
  incomingAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  incomingInitial: {
    fontFamily: fontFamily.sans700,
    fontSize: 32,
    color: colors.ink,
  },
  incomingTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 22,
    color: '#fff',
  },
  incomingSub: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: 'rgba(255,255,255,.65)',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.xxl,
  },
  incomingActionCol: {
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: 'rgba(255,255,255,.7)',
  },
  errorText: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
    textAlign: 'center',
  },
  roundButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: colors.onlineDot,
  },
  declineButton: {
    backgroundColor: colors.danger,
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
  callWrap: {
    flex: 1,
    backgroundColor: '#0B0F07',
    paddingTop: 60,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  callTitle: {
    textAlign: 'center',
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: '#fff',
    marginBottom: spacing.md,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  waitingWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    fontFamily: fontFamily.sans500,
    fontSize: 15,
    color: 'rgba(255,255,255,.75)',
  },
  tile: {
    flexGrow: 1,
    flexBasis: '48%',
    minHeight: 160,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  tileSingle: {
    flexBasis: '100%',
  },
  tileLabel: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    fontFamily: fontFamily.sans600,
    fontSize: 12,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,.6)',
    textShadowRadius: 4,
  },
  localTile: {
    position: 'absolute',
    right: spacing.md,
    bottom: 130,
    width: 92,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.25)',
  },
  localTileOff: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B0F07',
  },
  errorBanner: {
    textAlign: 'center',
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  controlButton: {
    backgroundColor: 'rgba(255,255,255,.16)',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255,255,255,.35)',
  },
});
