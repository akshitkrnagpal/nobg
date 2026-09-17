import {
  ArrowCounterClockwiseIcon,
  DownloadSimpleIcon,
  ImageIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState } from "react";

const endpoint = `${(import.meta.env.PUBLIC_API_URL || "https://api.nobg.akshit.io").replace(/\/$/, "")}/api/v1/remove-background`;
type Selection = { file: File; url: string; width: number; height: number };

export function UploadDemo() {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "ready" | "processing" | "done">("idle");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const busy = phase === "reading" || phase === "processing";

  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (selected) URL.revokeObjectURL(selected.url);
    },
    [selected],
  );
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result);
    },
    [result],
  );
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= retryAt) {
        setRetryAt(0);
        setError("");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  function reset() {
    generation.current++;
    request.current?.abort();
    setSelected(null);
    setResult(null);
    if (!retryAt) setError("");
    setPhase("idle");
    if (input.current) input.current.value = "";
  }

  async function choose(file: File) {
    if (busy) return;
    reset();
    const current = generation.current;
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setError("Choose a non-empty image under 10 MiB.");
      return;
    }
    if (
      file.type
        ? !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        : !/\.(jpe?g|png|webp)$/i.test(file.name)
    ) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    setPhase("reading");
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      if (current !== generation.current) return;
      if (width * height > 25_000_000)
        throw new Error("Choose an image with 25 megapixels or fewer.");
      setSelected({ file, url: URL.createObjectURL(file), width, height });
      setPhase("ready");
    } catch (error) {
      if (current !== generation.current) return;
      setError(
        error instanceof Error && error.message.startsWith("Choose")
          ? error.message
          : "This image could not be opened. Try another JPEG, PNG, or WebP.",
      );
      setPhase("idle");
    }
  }

  async function removeBackground() {
    if (!selected || busy || retryAt > Date.now()) return;
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90_000);
    setPhase("processing");
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.set("image", selected.file);
      form.set("format", "png");
      const response = await fetch(endpoint, {
        method: "POST",
        body: form,
        signal: controller.signal,
        credentials: "omit",
      });
      if (current !== generation.current) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 429) {
          const seconds = Number(response.headers.get("Retry-After"));
          const until =
            Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
          setRetryAt(until);
          const reason =
            payload?.error?.code === "monthly_limit_reached"
              ? "The free demo has reached its monthly image allowance."
              : payload?.error?.code === "daily_limit_reached"
                ? "This IP has used its daily image allowance."
                : "Too many requests from this IP.";
          throw new Error(
            `${reason} Try again after ${new Date(until).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`,
          );
        }
        if (response.status === 413)
          throw new Error("Choose an image under 10 MiB and 25 megapixels.");
        if (response.status === 400 || response.status === 415)
          throw new Error(
            "This image could not be processed. Try re-saving it as JPEG, PNG, or WebP.",
          );
        throw new Error("Background removal is unavailable right now. Please try again later.");
      }
      if (!response.headers.get("Content-Type")?.startsWith("image/png"))
        throw new Error("The service did not return an image. Please try again later.");
      const blob = await response.blob();
      if (!blob.size)
        throw new Error("The service returned an empty image. Please try again later.");
      if (current !== generation.current) return;
      setResult(URL.createObjectURL(blob));
      setPhase("done");
    } catch (error) {
      if (current !== generation.current) return;
      setError(
        timedOut
          ? "This request took too long. Try again later; the attempt may still count toward your allowance."
          : error instanceof TypeError
            ? "Could not reach the service. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
      );
      setPhase("ready");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  return (
    <section className="demo" id="demo" aria-labelledby="demo-title">
      <div className="demo-heading">
        <h2 id="demo-title">Try your image</h2>
        <span>Free · No sign-up</span>
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose an image"
        tabIndex={-1}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
        }}
      />
      {!selected ? (
        <button
          type="button"
          className="dropzone"
          data-dragging={dragging}
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length !== 1) {
              setError("Choose one image at a time.");
              return;
            }
            const file = event.dataTransfer.files[0];
            if (file) void choose(file);
          }}
        >
          <span className="upload-symbol">
            <UploadSimpleIcon size={32} aria-hidden="true" />
          </span>
          <strong>{phase === "reading" ? "Opening your image…" : "Choose an image"}</strong>
          <span>or drop it here</span>
          <small>JPEG, PNG or WebP · Up to 10 MiB</small>
        </button>
      ) : (
        <>
          <div className="demo-previews" aria-busy={phase === "processing"}>
            <figure>
              <figcaption>Original</figcaption>
              <div className="image-preview">
                <img src={selected.url} alt="Your original upload" />
              </div>
            </figure>
            <figure>
              <figcaption>Background removed</figcaption>
              <div className="image-preview transparent-preview">
                {result ? (
                  <img src={result} alt="Your subject with the background removed" />
                ) : (
                  <div className="result-placeholder">
                    <ImageIcon size={30} aria-hidden="true" />
                    <span>
                      {phase === "processing"
                        ? "Removing background…"
                        : "Your result will appear here"}
                    </span>
                  </div>
                )}
              </div>
            </figure>
          </div>
          <p className="selected-file" title={selected.file.name}>
            {selected.file.name}{" "}
            <span>
              {selected.width} × {selected.height}
            </span>
          </p>
          <div className="demo-actions">
            {result ? (
              <a
                className="button primary"
                href={result}
                download={`${selected.file.name.replace(/\.[^.]+$/, "")}-nobg.png`}
              >
                <DownloadSimpleIcon size={18} aria-hidden="true" />
                Download PNG
              </a>
            ) : (
              <button
                type="button"
                className="button primary"
                disabled={busy || retryAt > Date.now()}
                onClick={() => void removeBackground()}
              >
                {phase === "processing"
                  ? "Removing background…"
                  : retryAt
                    ? "Please wait to retry"
                    : "Remove background"}
              </button>
            )}
            <button type="button" className="text-link" onClick={reset}>
              <ArrowCounterClockwiseIcon size={17} aria-hidden="true" />
              {busy ? "Cancel" : "Choose another"}
            </button>
          </div>
        </>
      )}
      <p className="demo-status sr-only" role="status">
        {phase === "reading"
          ? "Opening your image."
          : phase === "ready"
            ? "Image selected. Ready to remove the background."
            : phase === "processing"
              ? "Removing the background. This may take a moment."
              : phase === "done"
                ? "Your image is ready. Download the PNG below."
                : ""}
      </p>
      {error && (
        <p className="demo-error" role="alert">
          {error}
        </p>
      )}
      <p className="demo-privacy">
        Your image is sent to Cloudflare when you choose Remove background. nobg does not store
        uploads or results.
      </p>
      <noscript>
        <p>
          Enable JavaScript to use the upload demo, or{" "}
          <a href="/docs/examples/">use the API from your terminal</a>.
        </p>
      </noscript>
    </section>
  );
}
