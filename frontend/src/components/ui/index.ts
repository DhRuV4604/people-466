/**
 * The People component library. Import from here so every screen pulls the
 * same primitives:
 *
 *   import { Button, Field, Input, InputGroup } from "@/components/ui";
 */

// Actions
export { Button, type ButtonProps } from "./button";
// Kept apart from the component so a server component can style a link as a
// button without importing the client module.
export {
  buttonVariants,
  type ButtonVariantProps,
} from "./button-variants";
export { IconButton, type IconButtonProps } from "./icon-button";

// Forms
export { Checkbox, CheckboxField, type CheckboxProps } from "./checkbox";
export { DatePicker, type DatePickerProps } from "./date-picker";
export { Field, FieldError, FieldHeader, FieldLabel } from "./field";
export {
  Input,
  InputAddon,
  InputGroup,
  inputGroupVariants,
  type InputAddonProps,
  type InputGroupProps,
  type InputProps,
} from "./input";
export { Label } from "./label";
export { Select, type SelectOption, type SelectProps } from "./select";
export { Textarea } from "./textarea";

// Display
export { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "./avatar";
export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
export { BackLink, PageHeader, type PageHeaderProps } from "./page-header";
export { Badge, badgeVariants } from "./badge";
export { BrandMark } from "./brand-mark";
export { Calendar } from "./calendar";
export {
  ProfileCard,
  ProfileMenu,
  UserAvatar,
  type ProfileCardProps,
  type ProfileMenuProps,
  type UserAvatarProps,
} from "./profile";
export { Separator } from "./separator";
export { Skeleton } from "./skeleton";

// Overlays and navigation
export { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";
export { ToastProvider, useToast } from "./toast";
export {
  ThemeProvider,
  useTheme,
  type Theme,
  type Resolved,
} from "./theme";
export {
  DropdownMenuLinkItem,
  type DropdownMenuLinkItemProps,
} from "./menu-link-item";
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AvatarGroup,
  AvatarGroupTooltip,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  FileItem,
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  PreviewLinkCard,
  PreviewLinkCardContent,
  PreviewLinkCardImage,
  PreviewLinkCardTrigger,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  SubFiles,
  Switch,
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from "./overlays";

// Expressive components: motion is the point. Use sparingly.
export {
  Code,
  CodeBlock,
  CodeHeader,
  CodeTabs,
  CopyButton,
  Cursor,
  CursorFollow,
  CursorProvider,
  FlipButton,
  FlipButtonBack,
  FlipButtonFront,
  FlipCard,
  GitHubStarsButton,
  GitHubStarsWheel,
  LiquidButton,
  ManagementBar,
  MotionCarousel,
  NotificationList,
  ParticleIconButton,
  PinList,
  PlayfulTodolist,
  RadialIntro,
  RadialNav,
  RippleButton,
  RippleButtonRipples,
  ShareButton,
  ThemeTogglerButton,
  UserPresenceAvatar,
} from "./expressive";

// Artwork and brand marks
export { AuroraHero } from "./aurora-hero";
export { AppleIcon, GoogleIcon } from "./brand-icons";
