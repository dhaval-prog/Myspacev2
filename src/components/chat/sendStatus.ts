import { colors } from '../../theme';

export type SendStatus = 'thrown' | 'landed' | 'read';

export const STATUS_LABEL: Record<SendStatus, string> = { thrown: 'Thrown', landed: 'Landed', read: 'Read' };

export const STATUS_COLOR: Record<'day' | 'night', Record<SendStatus, string>> = {
  day: { thrown: 'rgba(22,33,12,0.5)', landed: 'rgba(22,33,12,0.72)', read: '#5C7A2E' },
  night: { thrown: 'rgba(237,253,255,0.45)', landed: 'rgba(237,253,255,0.72)', read: colors.lime },
};
