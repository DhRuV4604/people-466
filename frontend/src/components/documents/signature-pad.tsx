"use client";

import * as React from "react";
import { Eraser, PenLine, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** The typefaces offered for a typed signature, in the order they are shown. */
const HANDS = [
  { label: "Flowing", family: '"Segoe Script", "Bradley Hand", cursive' },
  { label: "Upright", family: '"Palatino Linotype", Palatino, Georgia, serif' },
  { label: "Plain", family: 'Inter, system-ui, sans-serif' },
];

type Mode = "draw" | "type";

/**
 * Where a signature is made.
 *
 * Both modes end in the same place — a PNG data URL — so the server does not
 * need to know which was used and the certificate page treats them alike.
 * Drawing is offered first because it is what people expect to be asked for,
 * but typing exists because a trackpad makes a mess of a signature and an
 * unusable control is worse than a plain one.
 */
export function SignaturePad({
  value,
  onChange,
  disabled,
}: {
  /** The PNG data URL, or empty while nothing has been drawn or typed. */
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = React.useState<Mode>("draw");
  const [typed, setTyped] = React.useState("");
  const [hand, setHand] = React.useState(0);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const drew = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);

  /**
   * Sizes the bitmap to the device rather than to CSS pixels, so the stroke is
   * not a blurry rectangle on the phones this is most likely to be signed on.
   */
  const prepare = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // Rounded, because assigning to canvas.width truncates: comparing against
    // the raw float would never match, and re-assigning the width clears the
    // bitmap, so every pointermove would wipe the stroke being drawn.
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.2;
    context.strokeStyle = "#111827";
    return context;
  }, []);

  React.useEffect(() => {
    if (mode !== "draw") return;
    prepare();
  }, [mode, prepare]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    // Capture keeps the stroke alive when the pointer leaves the box, but it
    // is not worth losing the stroke over: some browsers refuse the id, and a
    // signature pad that silently does nothing is the worst version of this.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Drawing still works without it.
    }
    drawing.current = true;
    drew.current = false;
    last.current = pointFrom(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const context = prepare();
    const from = last.current;
    if (!context || !from) return;

    const to = pointFrom(event);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    last.current = to;

    if (!drew.current) {
      drew.current = true;
      // Published on the first movement rather than only on release, so the
      // submit button enables as soon as there is something to submit.
      const canvas = canvasRef.current;
      if (canvas) onChange(canvas.toDataURL("image/png"));
    }
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    // Published again on release: the first movement only carried the opening
    // stroke, and this is the finished mark.
    const canvas = canvasRef.current;
    if (canvas && drew.current) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    drew.current = false;
    onChange("");
  };

  /**
   * Renders typed text to the same kind of PNG a drawn signature produces, so
   * everything downstream — the request body, the certificate page — has one
   * shape to deal with.
   */
  const renderTyped = React.useCallback(
    (text: string, family: string) => {
      if (!text.trim()) {
        onChange("");
        return;
      }

      const ratio = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = 640 * ratio;
      canvas.height = 160 * ratio;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      context.fillStyle = "#111827";
      context.textBaseline = "middle";
      context.font = `44px ${family}`;
      context.fillText(text.slice(0, 40), 12, 80);

      onChange(canvas.toDataURL("image/png"));
    },
    [onChange],
  );

  React.useEffect(() => {
    if (mode !== "type") return;
    renderTyped(typed, HANDS[hand].family);
  }, [mode, typed, hand, renderTyped]);

  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="signature-pad">Your signature</FieldLabel>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(
            [
              ["draw", "Draw", PenLine],
              ["type", "Type", Type],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => {
                setMode(key);
                onChange("");
                if (key === "draw") drew.current = false;
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas
            id="signature-pad"
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            aria-label="Draw your signature"
            className={cn(
              "h-40 w-full rounded-xl border border-input bg-background",
              // The browser would otherwise read a drag as a scroll and the
              // stroke would stop halfway down the page.
              "touch-none",
              disabled && "pointer-events-none opacity-60",
            )}
          />
          <span className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-border" />
          {!value ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Sign here
            </span>
          ) : null}
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              startIcon={<Eraser />}
              onClick={clear}
              disabled={disabled || !value}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Input
            id="signature-pad"
            value={typed}
            disabled={disabled}
            placeholder="Type your name"
            onChange={(event) => setTyped(event.target.value)}
            aria-label="Type your signature"
          />
          <div className="flex flex-wrap gap-2">
            {HANDS.map((option, index) => (
              <button
                key={option.label}
                type="button"
                disabled={disabled}
                onClick={() => setHand(index)}
                style={{ fontFamily: option.family }}
                className={cn(
                  "min-w-28 flex-1 rounded-xl border px-3 py-3 text-xl transition-colors",
                  hand === index
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50",
                )}
              >
                {typed.trim() ? typed.slice(0, 18) : option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Field>
  );
}
