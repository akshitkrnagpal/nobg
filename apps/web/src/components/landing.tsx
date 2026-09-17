import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Home } from "./home";
import type { SiteProviderProps } from "./site-provider";
import { UploadDemo } from "./upload-demo";

export function Landing({ children, ...props }: SiteProviderProps) {
  return (
    <Home {...props}>
      <main id="main" tabIndex={-1}>
        <section className="hero demo-hero wrap">
          <div className="hero-copy">
            <h1>
              Keep the subject.
              <br />
              <span>Remove the background.</span>
            </h1>
            <p className="hero-description">
              Upload a photo and download a transparent PNG. No account or API key needed.
            </p>
            <p className="demo-allowance">20 images a day per IP · 5 requests a minute</p>
            <p className="setup-note">
              The free demo has a shared monthly allowance. Processing attempts count, including
              failures.
            </p>
            <a className="text-link" href="/docs/quickstart/">
              Want your own API? Self-host nobg <ArrowRightIcon size={18} aria-hidden="true" />
            </a>
          </div>
          <UploadDemo />
        </section>
        {children}
      </main>
    </Home>
  );
}
