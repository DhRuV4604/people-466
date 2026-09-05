import * as React from "react";

export function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.4 5.4 0 0 1-2.39 3.58v3h3.86c2.26-2.09 3.58-5.17 3.58-8.82"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1-.38-2.29c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75"
      />
    </svg>
  );
}

export function AppleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.81 3.15-.46 7.81 1.3 10.36.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84s2.01.84 3.39.81c1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.05-2.75-4.14M14.47 4.6c.71-.87 1.19-2.07 1.06-3.27-1.02.04-2.27.68-3.01 1.55-.66.76-1.24 1.99-1.09 3.16 1.14.09 2.31-.58 3.04-1.44" />
    </svg>
  );
}

/**
 * Brand marks that lucide-react v1 dropped. They take the same props as a
 * lucide icon, including `size`, so they drop into components that expected
 * the originals.
 */
type BrandIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string };

function brandProps({ size = 24, ...props }: BrandIconProps) {
  return { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, ...props };
}

export function GithubIcon(props: BrandIconProps) {
  return (
    <svg {...brandProps(props)} fill="currentColor">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5" />
    </svg>
  );
}

export function LinkedinIcon(props: BrandIconProps) {
  return (
    <svg {...brandProps(props)} fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M2.4 21.5h5.16V9.5H2.4zM10.4 9.5h4.95v1.64h.07c.69-1.24 2.37-2.55 4.88-2.55 5.22 0 6.18 3.3 6.18 7.59v5.32h-5.15v-4.72c0-1.13-.02-2.58-1.61-2.58-1.62 0-1.87 1.22-1.87 2.5v4.8H10.4z" />
    </svg>
  );
}

export function TwitterIcon(props: BrandIconProps) {
  return (
    <svg {...brandProps(props)} fill="currentColor">
      <path d="M17.53 3h3.24l-7.08 8.1L22 21h-6.52l-5.1-6.68L4.54 21H1.3l7.57-8.66L2 3h6.69l4.61 6.1zm-1.14 16.06h1.8L7.7 4.85H5.77z" />
    </svg>
  );
}

export function FacebookIcon(props: BrandIconProps) {
  return (
    <svg {...brandProps(props)} fill="currentColor">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12" />
    </svg>
  );
}
