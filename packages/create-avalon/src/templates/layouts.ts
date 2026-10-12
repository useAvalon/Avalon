import type { ProjectConfig, StarterTemplate } from "../types";
import { projectTemplate } from "../types";
import { escapeEmbeddedJsString } from "./escape";
import { jsxForCore } from "./jsx-dialect";

const STOREFRONT_MOTION_HEAD_SCRIPT = `
        <script>
          {\`if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            if ('IntersectionObserver' in window) {
              document.documentElement.dataset.motion = 'on';
            }
          }\`}
        </script>`;

const STOREFRONT_MOTION_BODY_SCRIPT = `
        <script>
          {\`(() => {
  if (document.documentElement.dataset.motion !== 'on') return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  );
  const observeAll = () => {
    document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((node) => observer.observe(node));
  };
  const scheduleObserve = () => {
    requestAnimationFrame(observeAll);
  };
  scheduleObserve();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleObserve);
  }
  document.addEventListener('avalon:after-swap', scheduleObserve);
  document.addEventListener('avalon:page-load', scheduleObserve);
})();\`}
        </script>`;

const STOREFRONT_NAV_SYNC_SCRIPT = `
        <script>
          {\`(() => {
  function navActive(pathname, href) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }
  function syncStorefrontNav() {
    const pathname = location.pathname;
    document.querySelectorAll('[data-nav-link]').forEach((link) => {
      const href = link.getAttribute('href') || '/';
      const active = navActive(pathname, href);
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  syncStorefrontNav();
  document.addEventListener('avalon:after-swap', syncStorefrontNav);
  document.addEventListener('avalon:page-load', syncStorefrontNav);
  window.addEventListener('popstate', syncStorefrontNav);
})();\`}
        </script>`;

function rootLayoutHtmlClassAttr(template: StarterTemplate): string {
	if (template === "blog") {
		return ' class="blog-theme"';
	}
	if (template === "storefront") {
		return ' class="storefront-theme"';
	}
	return "";
}

export function generateRootLayout(config: ProjectConfig): string {
	const imports: string[] = [];

	imports.push(`import type { LayoutProps } from '@useavalon/avalon';`);
	const template = projectTemplate(config);
	if (template === "blog") {
		imports.push(`import SiteNav from '../components/SiteNav.tsx';`);
	}
	if (template === "storefront") {
		imports.push(
			`import SiteHeader from '@modules/store/components/SiteHeader.tsx';`,
			`import SiteFooter from '@modules/store/components/SiteFooter.tsx';`,
			`import CartDrawer from '@modules/store/components/CartDrawer.tsx';`,
		);
	}

	const safeName = escapeEmbeddedJsString(config.projectName);
	const htmlClassAttr = rootLayoutHtmlClassAttr(template);
	const source = `${imports.join("\n")}

export default async function RootLayout({ children, frontmatter }: Readonly<LayoutProps>) {
  const title = typeof frontmatter?.title === 'string' ? frontmatter.title : '${safeName}';
  const description = typeof frontmatter?.description === 'string' ? frontmatter.description : '';

  return (
    <html lang="en"${htmlClassAttr}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/syntax-highlighting.css" />
        ${
					template === "blog"
						? `<link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />`
						: ""
				}${template === "storefront" ? STOREFRONT_MOTION_HEAD_SCRIPT : ""}
      </head>
      <body>
        ${template === "blog" ? "<SiteNav />\n        " : ""}${
					template === "storefront"
						? `<div data-router-persist="site-nav" class="sticky top-0 z-50">\n          <SiteHeader />\n        </div>\n        <CartDrawer island={{ condition: 'on:idle' }} />\n        `
						: ""
				}{children}${template === "storefront" ? "\n        <SiteFooter />" : ""}${template === "storefront" ? STOREFRONT_MOTION_BODY_SCRIPT : ""}${template === "storefront" ? STOREFRONT_NAV_SYNC_SCRIPT : ""}
      </body>
    </html>
  );
}
`;

	if (template === "storefront") {
		return jsxForCore(config.core, source);
	}
	return source;
}

export function generateAboutLayout(_config: ProjectConfig): string {
	return `import type { LayoutProps } from '@useavalon/avalon';

export default async function AboutLayout({ children }: Readonly<LayoutProps>) {
  return <>{children}</>;
}
`;
}
