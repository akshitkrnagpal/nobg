import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsPage, type DocsPageProps } from "fumadocs-ui/layouts/docs/page";
import { SiteProvider, type SiteProviderProps } from "./site-provider";
import { Wordmark } from "./wordmark";

export function Docs({
  tree,
  children,
  page,
  ...props
}: SiteProviderProps & {
  tree: Root;
  page?: DocsPageProps;
}) {
  return (
    <SiteProvider {...props}>
      <DocsLayout
        tree={tree}
        links={[{ text: "Home", url: "/" }]}
        themeSwitch={{ enabled: false }}
        nav={{ title: <Wordmark />, url: "/" }}
      >
        <DocsPage {...page}>{children}</DocsPage>
      </DocsLayout>
    </SiteProvider>
  );
}
