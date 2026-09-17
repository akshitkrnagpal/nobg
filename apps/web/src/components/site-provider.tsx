import { navigate } from "astro:transitions/client";
import type { AstroProviderProps } from "fumadocs-core/framework/astro";
import { RootProvider } from "fumadocs-ui/provider/astro";
import type { ReactNode } from "react";
import SearchDialog from "./search";

export interface SiteProviderProps {
  pathname: string;
  params: AstroProviderProps["params"];
  children: ReactNode;
}

export function SiteProvider({ pathname, params, children }: SiteProviderProps) {
  return (
    <RootProvider
      pathname={pathname}
      params={params}
      navigate={navigate}
      theme={{ enabled: false }}
      search={{ SearchDialog }}
    >
      {children}
    </RootProvider>
  );
}
