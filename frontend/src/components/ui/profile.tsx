"use client";

import * as React from "react";
import { LogOut, Settings, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

/** Two letters from a display name, used when there is no photo. */
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type UserAvatarProps = {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const AVATAR_SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
};

function UserAvatar({ name, src, size = "md", className }: UserAvatarProps) {
  return (
    <Avatar className={cn(AVATAR_SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="bg-muted font-medium text-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

type ProfileCardProps = {
  name: string;
  email: string;
  role?: string;
  src?: string;
  className?: string;
};

/** Identity block: who someone is, at a glance. */
function ProfileCard({ name, email, role, src, className }: ProfileCardProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <UserAvatar name={name} src={src} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {role ? `${role} · ${email}` : email}
        </p>
      </div>
    </div>
  );
}

type ProfileMenuProps = ProfileCardProps & {
  onSignOut?: () => void;
};

/** The avatar in a header, opening the account menu. */
function ProfileMenu({ name, email, role, src, onSignOut }: ProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <UserAvatar name={name} src={src} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <ProfileCard name={name} email={email} role={role} src={src} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <UserRound />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export {
  ProfileCard,
  ProfileMenu,
  UserAvatar,
  type ProfileCardProps,
  type ProfileMenuProps,
  type UserAvatarProps,
};
