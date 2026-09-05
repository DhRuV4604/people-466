"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

import {
  Button,
  CheckboxField,
  Field,
  FieldError,
  FieldHeader,
  FieldLabel,
  IconButton,
  Input,
  InputAddon,
  InputGroup,
} from "@/components/ui";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { Slide } from "@/components/animate-ui/primitives/effects/slide";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { LogIn } from "@/components/animate-ui/icons/log-in";
import { loginAction, type LoginState } from "@/app/login/actions";

const INITIAL: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = React.useActionState(
    loginAction,
    INITIAL,
  );
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(false);

  return (
    <form action={formAction} noValidate>
      <Slide direction="up" offset={20} delay={100}>
        <div className="text-center">
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-balance">
            Sign in to your PeoplePay360 account to pick up where you left off.
          </p>
        </div>
      </Slide>

      <div className="mt-9 flex flex-col gap-5">
        {/* Whatever the API said. It uses one message for unknown email,
            wrong password and deactivated account on purpose. */}
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
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <InputGroup invalid={!!state.fieldErrors?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                defaultValue=""
                aria-invalid={!!state.fieldErrors?.email}
                disabled={pending}
              />
            </InputGroup>
            <FieldError message={state.fieldErrors?.email} />
          </Field>
        </Fade>

        <Fade delay={310}>
          <Field>
            <FieldHeader>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="#"
                className="rounded text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                Forgot password?
              </Link>
            </FieldHeader>
            <InputGroup invalid={!!state.fieldErrors?.password}>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={!!state.fieldErrors?.password}
                disabled={pending}
              />
              <InputAddon side="end">
                <IconButton
                  size="sm"
                  label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  icon={showPassword ? <EyeOff /> : <Eye />}
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={pending}
                />
              </InputAddon>
            </InputGroup>
            <FieldError message={state.fieldErrors?.password} />
          </Field>
        </Fade>

        <Fade delay={380}>
          <CheckboxField
            id="remember"
            name="remember"
            checked={remember}
            onCheckedChange={(checked) => setRemember(checked === true)}
            disabled={pending}
          >
            Keep me signed in
          </CheckboxField>
        </Fade>

        <Fade delay={450}>
          <AnimateIcon animateOnHover asChild>
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={pending}
              loadingText="Signing in"
              endIcon={<LogIn />}
            >
              Log in
            </Button>
          </AnimateIcon>
        </Fade>

        <Fade delay={520}>
          <p className="text-center text-sm text-muted-foreground">
            Trouble signing in?{" "}
            <Link
              href="#"
              className="rounded font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              Contact your administrator
            </Link>
          </p>
        </Fade>
      </div>
    </form>
  );
}
