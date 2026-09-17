import { HomeLayout } from "fumadocs-ui/layouts/home";
import { SiteProvider, type SiteProviderProps } from "./site-provider";
import { Wordmark } from "./wordmark";

export function Home({ children, ...props }: SiteProviderProps) {
  return (
    <SiteProvider {...props}>
      <HomeLayout
        className="nobg-home"
        nav={{ title: <Wordmark />, url: "/" }}
        themeSwitch={{ enabled: false }}
        links={[
          { text: "Documentation", url: "/docs/" },
          { text: "API reference", url: "/docs/api/" },
          { text: "Self-host nobg", url: "/docs/quickstart/", type: "button", secondary: true },
        ]}
      >
        {children}
      </HomeLayout>
    </SiteProvider>
  );
}
