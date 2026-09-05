"use client";

import * as React from "react";
import { AlertCircle, Eye, EyeOff, KeyRound } from "lucide-react";

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  IconButton,
  Input,
  InputAddon,
  InputGroup,
} from "@/components/ui";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { Slide } from "@/components/animate-ui/primitives/effects/slide";

import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";

const INITIAL: ChangePasswordState = {};

/**
 * One field, with a reveal control, since a password typed blind is a typo.
 *
 * Controlled rather than uncontrolled: React clears an uncontrolled input once
 * a form action returns, so a mismatched confirmation would empty all three
 * boxes and ask the person to type everything again.
 */
function PasswordField({
  id,
  label,
  hint,
  autoComplete,
  error,
  disabled,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  autoComplete: string;
  error?: string;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [shown, setShown] = React.useState(false);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup invalid={!!error}>
        <Input
          id={id}
          name={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <InputAddon side="end">
          <IconButton
            type="button"
            size="sm"
            label={shown ? "Hide password" : "Show password"}
            icon={shown ? <EyeOff /> : <Eye />}
            onClick={() => setShown((value) => !value)}
          />
        </InputAddon>
      </InputGroup>
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <FieldError message={error} />
    </Field>
  );
}

export function ChangePasswordForm({
  name,
  invited,
}: {
  name: string;
  /** True when they are here because the password they used was issued. */
  invited: boolean;
}) {
  const [state, formAction, pending] = React.useActionState(
    changePasswordAction,
    INITIAL,
  );

  const [values, setValues] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (value: string) =>
      setValues((current) => ({ ...current, [key]: value })),
  });

  return (
    <form action={formAction} noValidate>
      <Slide direction="up" offset={20} delay={100}>
        <div className="text-center">
          <span className="mx-auto mb-5 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight">
            {invited ? "Choose a password" : "Change your password"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-balance text-muted-foreground">
            {invited
              ? `Welcome, ${name}. The password in your invite works once — pick your own to finish setting up.`
              : "Enter the password you use now, then the one you would like instead."}
          </p>
        </div>
      </Slide>

      <div className="mt-9 flex flex-col gap-5">
        {state.error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        ) : null}

        <Fade delay={240}>
          <PasswordField
            id="currentPassword"
            {...field("currentPassword")}
            label={invited ? "Password from your invite" : "Current password"}
            autoComplete="current-password"
            error={state.fieldErrors?.currentPassword}
            disabled={pending}
          />
        </Fade>

        <Fade delay={310}>
          <PasswordField
            id="newPassword"
            {...field("newPassword")}
            label="New password"
            hint="At least 8 characters."
            autoComplete="new-password"
            error={state.fieldErrors?.newPassword}
            disabled={pending}
          />
        </Fade>

        <Fade delay={380}>
          <PasswordField
            id="confirmPassword"
            {...field("confirmPassword")}
            label="New password again"
            autoComplete="new-password"
            error={state.fieldErrors?.confirmPassword}
            disabled={pending}
          />
        </Fade>

        <Fade delay={450}>
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={pending}
            loadingText="Saving"
          >
            Save and continue
          </Button>
        </Fade>
      </div>
    </form>
  );
}
