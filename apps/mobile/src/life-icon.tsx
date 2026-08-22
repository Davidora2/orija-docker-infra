import {
  AirplaneTilt,
  Archive,
  ArrowSquareOut,
  Barbell,
  Briefcase,
  CalendarBlank,
  CalendarPlus,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChartLineUp,
  Check,
  CheckCircle,
  Compass,
  Copy,
  EnvelopeSimple,
  Folders,
  Gauge,
  Gear,
  GoogleLogo,
  GridFour,
  Heart,
  House,
  Key,
  Leaf,
  Lightbulb,
  LinkSimple,
  Lock,
  Palette,
  PaperPlaneTilt,
  Plugs,
  Plus,
  Receipt,
  ShareNetwork,
  ShieldCheck,
  SignIn,
  SignOut,
  Sparkle,
  Stack,
  Sun,
  Target,
  TrendUp,
  User,
  UserPlus,
  Users,
  Wallet,
  Warning,
  WarningCircle,
  X,
  type Icon,
  type IconWeight,
} from 'phosphor-react-native';

export type LifeIconName =
  | 'today'
  | 'plan'
  | 'calendar'
  | 'money'
  | 'you'
  | 'areas'
  | 'projects'
  | 'ideas'
  | 'priority'
  | 'capacity'
  | 'review'
  | 'settings'
  | 'archive'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'add'
  | 'check'
  | 'calendar-edit'
  | 'warning'
  | 'household'
  | 'integrations'
  | 'done'
  | 'area'
  | 'health'
  | 'career'
  | 'relationships'
  | 'family'
  | 'growth'
  | 'creative'
  | 'business'
  | 'faith'
  | 'adventure'
  | 'shield'
  | 'lock'
  | 'user-add'
  | 'sign-in'
  | 'email'
  | 'key'
  | 'link'
  | 'send'
  | 'share'
  | 'sign-out'
  | 'error'
  | 'google'
  | 'copy'
  | 'external'
  | 'overview'
  | 'spending'
  | 'wealth';

const ICONS: Record<LifeIconName, Icon> = {
  today: Sun,
  plan: Stack,
  calendar: CalendarBlank,
  money: Wallet,
  you: User,
  areas: GridFour,
  projects: Folders,
  ideas: Lightbulb,
  priority: Target,
  capacity: Gauge,
  review: ChartBar,
  settings: Gear,
  archive: Archive,
  'chevron-left': CaretLeft,
  'chevron-right': CaretRight,
  close: X,
  add: Plus,
  check: Check,
  'calendar-edit': CalendarPlus,
  warning: Warning,
  household: Users,
  integrations: Plugs,
  done: CheckCircle,
  area: Compass,
  health: Barbell,
  career: TrendUp,
  relationships: Heart,
  family: House,
  growth: Sparkle,
  creative: Palette,
  business: Briefcase,
  faith: Leaf,
  adventure: AirplaneTilt,
  shield: ShieldCheck,
  lock: Lock,
  'user-add': UserPlus,
  'sign-in': SignIn,
  email: EnvelopeSimple,
  key: Key,
  link: LinkSimple,
  send: PaperPlaneTilt,
  share: ShareNetwork,
  'sign-out': SignOut,
  error: WarningCircle,
  google: GoogleLogo,
  copy: Copy,
  external: ArrowSquareOut,
  overview: GridFour,
  spending: Receipt,
  wealth: ChartLineUp,
};

const LEGACY_ICON_MAP: Record<string, LifeIconName> = {
  'fitness-outline': 'health',
  'trending-up-outline': 'career',
  'wallet-outline': 'money',
  'heart-outline': 'relationships',
  'home-outline': 'family',
  'sparkles-outline': 'growth',
  'color-palette-outline': 'creative',
  'layers-outline': 'plan',
  'briefcase-outline': 'business',
  'leaf-outline': 'faith',
  'people-outline': 'household',
  'airplane-outline': 'adventure',
  'compass-outline': 'area',
  'speedometer-outline': 'capacity',
  'stats-chart-outline': 'review',
  'extension-puzzle-outline': 'integrations',
  'settings-outline': 'settings',
  'sunny-outline': 'today',
  'calendar-outline': 'calendar',
  'person-outline': 'you',
  'checkmark-circle-outline': 'done',
  'warning-outline': 'warning',
  'chevron-forward': 'chevron-right',
  'chevron-back': 'chevron-left',
  add: 'add',
  '🌿': 'faith',
  '💪': 'health',
  '💼': 'business',
  '🏠': 'family',
  '🎯': 'priority',
  '📚': 'growth',
  '💚': 'relationships',
  '✨': 'growth',
  '📌': 'priority',
};

const AREA_FALLBACKS: LifeIconName[] = [
  'faith',
  'health',
  'business',
  'family',
  'priority',
  'growth',
  'relationships',
  'creative',
];

export function lifeIconFromLegacy(
  value: unknown,
  fallbackIndex = 0,
): LifeIconName {
  if (typeof value === 'string' && LEGACY_ICON_MAP[value]) {
    return LEGACY_ICON_MAP[value];
  }
  return AREA_FALLBACKS[
    ((fallbackIndex % AREA_FALLBACKS.length) + AREA_FALLBACKS.length) %
      AREA_FALLBACKS.length
  ];
}

export function LifeIcon({
  name,
  size = 20,
  color = '#617A57',
  weight = 'regular',
  label,
}: {
  name: LifeIconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
  label?: string;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      color={color}
      size={size}
      title={label}
      weight={weight}
    />
  );
}
