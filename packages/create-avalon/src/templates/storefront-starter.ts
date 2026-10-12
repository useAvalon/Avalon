import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectConfig } from "../types";
import { jsxForCore } from "./jsx-dialect";

const ROUTER_TRANSITION_SLIDE = 'data-router-transition="slide-forward"';
const ROUTER_PERSIST_SITE_NAV = 'data-router-persist="site-nav"';

const GENERATED_SLUG_FROM_PATH_FN = String.raw`function slugFromPath(path: string): string {
  return path.replace(/^\.\.\/content\/products\//, '').replace(/\.json$/, '');
}`;

/** Bundled CLI lives in dist/; Vitest loads this file from src/templates/. */
function storefrontAssetsRoot(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [join(here, "../storefront-assets"), join(here, "../../storefront-assets")];
	return candidates.find((path) => existsSync(join(path, "storefront-theme.css"))) ?? candidates[0];
}

export function getStorefrontThemeCss(): string {
	return readFileSync(join(storefrontAssetsRoot(), "storefront-theme.css"), "utf8");
}

async function copyStorefrontAssets(targetDir: string): Promise<void> {
	const root = storefrontAssetsRoot();
	const theme = await readFile(join(root, "storefront-theme.css"), "utf8");
	await Promise.all([
		cp(join(root, "fonts"), join(targetDir, "public/fonts"), { recursive: true }),
		cp(join(root, "media"), join(targetDir, "public/media"), { recursive: true }),
		writeFile(join(targetDir, "app/shared/styles/storefront-theme.css"), theme),
	]);
}

export async function writeStorefrontStarterFiles(
	config: ProjectConfig,
	targetDir: string,
): Promise<void> {
	await copyStorefrontAssets(targetDir);

	const storeDir = join(targetDir, "app/modules/store");
	const mainPages = join(targetDir, "app/modules/main/pages");
	const productPageDir = join(mainPages, "products");

	await mkdir(productPageDir, { recursive: true });

	const jsx = (source: string) => jsxForCore(config.core, source);

	await Promise.all([
		writeFile(join(storeDir, "lib/site.ts"), generateSiteConfig(config)),
		writeFile(join(storeDir, "lib/products.ts"), generateProductsLib()),
		writeFile(join(storeDir, "lib/cart.ts"), generateCartLib()),
		writeFile(join(storeDir, "components/SiteHeader.tsx"), jsx(generateSiteHeader())),
		writeFile(join(storeDir, "components/SiteFooter.tsx"), jsx(generateSiteFooter())),
		writeFile(join(storeDir, "components/CartDrawer.tsx"), jsx(generateCartDrawer())),
		writeFile(join(storeDir, "components/CatalogBrowser.tsx"), jsx(generateCatalogBrowser())),
		writeFile(join(storeDir, "components/ProductCard.tsx"), jsx(generateProductCard())),
		writeFile(join(storeDir, "components/AddToCartButton.tsx"), jsx(generateAddToCartButton())),
		writeFile(join(storeDir, "components/CartPageClient.tsx"), jsx(generateCartPageClient())),
		writeFile(join(mainPages, "catalog.tsx"), jsx(generateCatalogPage())),
		writeFile(join(mainPages, "cart.tsx"), jsx(generateCartPage())),
		writeFile(join(mainPages, "about.tsx"), jsx(generateAboutPage())),
		writeFile(join(productPageDir, "[slug].tsx"), jsx(generateProductDetailPage())),
		writeFile(join(targetDir, "STOREFRONT.md"), generateStorefrontReadme()),
		writeFile(join(targetDir, "ATTRIBUTION.md"), generateAttribution()),
		...generateProductJsonFiles(storeDir),
	]);
}

function generateAttribution(): string {
	return `# Theme attribution

The **storefront** starter is adapted from [Atelier Kō](https://github.com/xocothemes/atelier-ko) by xocothemes (MIT).

- Original design, typography, and commerce UX patterns
- Converted from Astro to Avalon (Preact islands, Nitro routing, MDX-free product JSON)

Replace demo copy, photography, and prices before publishing.
`;
}

function generateStorefrontReadme(): string {
	return `# Storefront starter

Minimal furniture-catalogue scaffold based on **Atelier Kō** ([xocothemes/atelier-ko](https://github.com/xocothemes/atelier-ko), MIT).

## Customize

1. \`app/modules/store/lib/site.ts\` — studio name, navigation, footer, currency
2. \`app/modules/store/content/products/*.json\` — catalogue (add files; slug = filename)
3. \`public/media/\` — product and hero photography
4. \`app/shared/styles/storefront-theme.css\` — design tokens (\`:root\`, \`@theme\`)

## Cart

Cart state is \`localStorage\` only (demo). Wire \`/cart\` to your payment provider for production.

## Client navigation

This template ships with \`clientRouter: true\`, slide-forward View Transitions (\`${ROUTER_TRANSITION_SLIDE}\`), and a persistent site header (\`${ROUTER_PERSIST_SITE_NAV}\`). See [Client navigation](https://useavalon.dev/docs/client-navigation).

## Routes

| Path | Page |
|------|------|
| \`/\` | Editorial homepage |
| \`/catalog\` | Filterable catalogue |
| \`/products/[slug]\` | Product detail |
| \`/cart\` | Cart + checkout preview |
| \`/about\` | Studio story |
`;
}

function generateSiteConfig(config: ProjectConfig): string {
	const name = JSON.stringify(config.projectName);
	return `export interface NavItem {
  label: string;
  href: string;
}

export interface FooterColumn {
  heading: string;
  links: NavItem[];
}

export const siteConfig = {
  name: ${name},
  tagline: 'Furniture, made by hand',
  description:
    'A small atelier crafting solid oak, ash and walnut furniture by hand. Made to order.',
  defaultTitle: ${name} + ' — Hand-made furniture',
  email: 'hello@example.com',
  location: { region: 'Småland', country: 'SE' },
  themeColor: '#f4f4f2',
  navigation: [
    { label: 'Index', href: '/' },
    { label: 'Catalogue', href: '/catalog' },
    { label: 'Studio', href: '/about' },
  ] satisfies NavItem[],
  footerBlurb:
    'A two-person workshop. Solid oak, ash and walnut — cut, joined and finished by hand.',
  footerColumns: [
    {
      heading: 'Catalogue',
      links: [
        { label: 'All pieces', href: '/catalog' },
        { label: 'The studio', href: '/about' },
        { label: 'Your cart', href: '/cart' },
      ],
    },
  ] satisfies FooterColumn[],
  commerce: {
    locale: 'en-US',
    currency: 'USD',
    shippingFlatRate: 120,
  },
  featured: {
    homepageGrid: ['arvid-chair', 'tora-desk'],
    homepageSolo: 'arvid-chair',
  },
} as const;

export function pageTitle(page: string): string {
  return \`\${page} — \${siteConfig.name}\`;
}
`;
}

function generateProductsLib(): string {
	return `export interface Product {
  slug: string;
  name: string;
  collection: string;
  category: string;
  material: string;
  price: number;
  shortDescription: string;
  description: string;
  dimensions: string;
  finish: string;
  leadTime: string;
  images: string[];
  order: number;
}

type ProductFile = Omit<Product, 'slug' | 'description'> & { description?: string };

const productModules = import.meta.glob('../content/products/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, ProductFile>;

${GENERATED_SLUG_FROM_PATH_FN}

export function getProducts(): Product[] {
  return Object.entries(productModules)
    .map(([path, data]) => ({
      slug: slugFromPath(path),
      description: data.description ?? '',
      ...data,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function getProduct(slug: string): Product | undefined {
  return getProducts().find((product) => product.slug === slug);
}

export function getProductFilters(products: Product[]) {
  return {
    categories: [...new Set(products.map((p) => p.category))],
    materials: [...new Set(products.map((p) => p.material))],
  };
}

import { siteConfig } from './site.ts';

export function formatPrice(value: number): string {
  return new Intl.NumberFormat(siteConfig.commerce.locale, {
    style: 'currency',
    currency: siteConfig.commerce.currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function requireProduct(products: Product[], slug: string): Product {
  const product = products.find((entry) => entry.slug === slug);
  if (!product) {
    throw new Error(\`Featured slug "\${slug}" is missing from app/modules/store/content/products.\`);
  }
  return product;
}
`;
}

function generateCartLib(): string {
	return `export interface CartLine {
  slug: string;
  quantity: number;
}

const STORAGE_KEY = 'avalon-storefront-cart';
let transientCart: CartLine[] | null = null;

export function readCart(): CartLine[] {
  if (transientCart !== null) return transientCart.map((line) => ({ ...line }));
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
      transientCart = null;
    } else {
      transientCart = lines;
    }
  } catch {
    transientCart = lines;
    // Quota, private mode, or disabled storage — UI still updates via event detail.
  }
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function openCartDrawer(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('storefront:cart-open'));
}

export function addToCart(slug: string, quantity = 1): CartLine[] {
  const lines = readCart();
  const existing = lines.find((line) => line.slug === slug);
  if (existing) {
    existing.quantity += quantity;
  } else {
    lines.push({ slug, quantity });
  }
  writeCart(lines);
  window.dispatchEvent(new CustomEvent('storefront:cart', { detail: lines }));
  openCartDrawer();
  return lines;
}

export function removeFromCart(slug: string): CartLine[] {
  const next = readCart().filter((line) => line.slug !== slug);
  writeCart(next);
  window.dispatchEvent(new CustomEvent('storefront:cart', { detail: next }));
  return next;
}

export function setLineQuantity(slug: string, quantity: number): CartLine[] {
  const next = readCart()
    .map((line) => (line.slug === slug ? { ...line, quantity } : line))
    .filter((line) => line.quantity > 0);
  writeCart(next);
  window.dispatchEvent(new CustomEvent('storefront:cart', { detail: next }));
  return next;
}
`;
}

function generateSiteHeader(): string {
	return `import { siteConfig } from '../lib/site.ts';

export default function SiteHeader() {
  return (
    <header class="site-header">
      <nav class="shell flex h-[4.5rem] items-center justify-between gap-6" aria-label="Main">
        <a
          href="/"
          class="-m-2 p-2 text-[0.9375rem] font-semibold uppercase tracking-[-0.01em] transition-colors hover:text-accent"
          ${ROUTER_TRANSITION_SLIDE}
        >
          {siteConfig.name}
        </a>
        <ul class="hidden items-center gap-9 md:flex">
          {siteConfig.navigation.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                class="nav-link link link-mono"
                data-nav-link
                ${ROUTER_TRANSITION_SLIDE}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          data-cart-toggle
          class="link-mono -m-2 inline-flex items-center gap-2 p-2 transition-colors hover:text-accent"
          aria-expanded="false"
          aria-controls="cart-drawer-panel"
        >
          <span class="hidden sm:inline">Cart</span>
          <span class="mono text-[0.6875rem]" data-cart-count>
            00
          </span>
        </button>
      </nav>
    </header>
  );
}
`;
}

function generateSiteFooter(): string {
	return `import { siteConfig } from '../lib/site.ts';

export default function SiteFooter() {
  return (
    <footer class="mt-24 border-t border-line md:mt-36">
      <div class="shell grid gap-10 py-16 md:grid-cols-12">
        <div class="md:col-span-5">
          <p class="type-body max-w-md">{siteConfig.footerBlurb}</p>
          <p class="mono mt-4 text-[0.6875rem] text-muted">{siteConfig.email}</p>
        </div>
        {siteConfig.footerColumns.map((column) => (
          <div key={column.heading} class="md:col-span-2">
            <p class="label mb-4">{column.heading}</p>
            <ul class="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    class="link-mono text-muted hover:text-accent"
                    ${ROUTER_TRANSITION_SLIDE}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
`;
}

function generateProductCard(): string {
	return `import type { Product } from '../lib/products.ts';
import { formatPrice } from '../lib/products.ts';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  return (
    <a
      href={\`/products/\${product.slug}\`}
      class="group block border-t border-line pt-6"
      ${ROUTER_TRANSITION_SLIDE}
      data-product-card
      data-category={product.category}
      data-material={product.material}
      data-price={product.price}
    >
      <div class="aspect-[4/5] overflow-hidden bg-surface">
        <img
          src={product.images[0]}
          alt=""
          class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          loading="lazy"
        />
      </div>
      <div class="mt-4 flex items-baseline justify-between gap-4">
        <div>
          <p class="label">{product.collection}</p>
          <h2 class="type-h3 mt-2">{product.name}</h2>
          <p class="mono mt-1 text-[0.6875rem] text-muted">
            {product.material} · {product.finish}
          </p>
        </div>
        <p class="mono text-sm">{formatPrice(product.price)}</p>
      </div>
    </a>
  );
}
`;
}

function generateCatalogBrowser(): string {
	return `import { useMemo, useState } from 'preact/hooks';
import type { Product } from '../lib/products.ts';
import ProductCard from './ProductCard.tsx';

interface Props {
  products: Product[];
  categories: string[];
  materials: string[];
}

export default function CatalogBrowser({ products, categories, materials }: Props) {
  const [category, setCategory] = useState('all');
  const [material, setMaterial] = useState('all');
  const [sort, setSort] = useState('featured');

  const visible = useMemo(() => {
    let list = products.filter((product) => {
      const categoryMatch = category === 'all' || product.category === category;
      const materialMatch = material === 'all' || product.material === material;
      return categoryMatch && materialMatch;
    });
    if (sort === 'price-asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    }
    return list;
  }, [products, category, material, sort]);

  return (
    <>
      <div class="border-t border-line pb-10 pt-7" aria-label="Filter and sort">
        <div class="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-5">
            <div>
              <p class="label mb-2.5">Category</p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="chip"
                  aria-pressed={category === 'all'}
                  onClick={() => setCategory('all')}
                >
                  All
                </button>
                {categories.map((value) => (
                  <button
                    key={value}
                    type="button"
                    class="chip"
                    aria-pressed={category === value}
                    onClick={() => setCategory(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p class="label mb-2.5">Material</p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="chip"
                  aria-pressed={material === 'all'}
                  onClick={() => setMaterial('all')}
                >
                  All
                </button>
                {materials.map((value) => (
                  <button
                    key={value}
                    type="button"
                    class="chip"
                    aria-pressed={material === value}
                    onClick={() => setMaterial(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label class="label mb-2.5 block" htmlFor="catalog-sort">
              Sort
            </label>
            <select
              id="catalog-sort"
              class="field mono w-full text-[0.8125rem] lg:w-52"
              value={sort}
              onChange={(event) => setSort((event.target as HTMLSelectElement).value)}
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price — low to high</option>
              <option value="price-desc">Price — high to low</option>
            </select>
          </div>
        </div>
        <p class="mono mt-6 text-[0.6875rem] text-muted">
          {visible.length} piece{visible.length === 1 ? '' : 's'}
        </p>
      </div>
      <div class="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
      {visible.length === 0 ? (
        <p class="type-body py-16 text-center">No pieces match these filters.</p>
      ) : null}
    </>
  );
}
`;
}

function generateCartDrawer(): string {
	return `import { useEffect, useState } from 'preact/hooks';
import { cartCount, readCart, removeFromCart, setLineQuantity } from '../lib/cart.ts';
import { formatPrice, getProduct, getProducts } from '../lib/products.ts';

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ReturnType<typeof readCart>>([]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    for (const node of document.querySelectorAll('[data-cart-toggle]')) {
      node.setAttribute('aria-expanded', String(open));
    }
  }, [open]);

  useEffect(() => {
    function sync(event?: Event) {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      setLines(Array.isArray(detail) ? detail : readCart());
    }
    sync();
    window.addEventListener('storefront:cart', sync);
    return () => window.removeEventListener('storefront:cart', sync);
  }, []);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('storefront:cart-open', onOpen);
    return () => window.removeEventListener('storefront:cart-open', onOpen);
  }, []);

  useEffect(() => {
    function onToggle(event: Event) {
      event.preventDefault();
      setOpen((value) => !value);
    }
    for (const node of document.querySelectorAll('[data-cart-toggle]')) {
      node.addEventListener('click', onToggle);
    }
    return () => {
      for (const node of document.querySelectorAll('[data-cart-toggle]')) {
        node.removeEventListener('click', onToggle);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    for (const node of document.querySelectorAll('[data-cart-count]')) {
      node.textContent = String(cartCount(lines)).padStart(2, '0');
    }
  }, [lines]);

  const catalogue = getProducts();
  const subtotal = lines.reduce((sum, line) => {
    const product = getProduct(line.slug);
    return sum + (product ? product.price * line.quantity : 0);
  }, 0);

  return (
    <div class="cart-drawer" data-cart-drawer hidden={!open}>
      <button type="button" class="cart-backdrop" data-cart-close aria-label="Close cart" onClick={() => setOpen(false)} />
      <div
        id="cart-drawer-panel"
        class="cart-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-heading"
      >
        <div class="cart-panel-head">
          <h2 id="cart-drawer-heading" class="text-[0.9375rem] font-semibold uppercase tracking-[-0.01em]">
            Cart <span class="mono text-[0.6875rem] font-normal text-muted">{String(cartCount(lines)).padStart(2, '0')}</span>
          </h2>
          <button type="button" class="-mr-2 inline-flex size-10 items-center justify-center" data-cart-close onClick={() => setOpen(false)}>
            <span class="sr-only">Close</span>×
          </button>
        </div>
        <div class="cart-panel-body">
          {lines.length === 0 ? (
            <div class="py-14 text-center">
              <p class="type-body text-[0.9375rem]">Nothing selected yet.</p>
              <a
                href="/catalog"
                class="btn btn-outline mt-6 w-full"
                data-cart-close
                ${ROUTER_TRANSITION_SLIDE}
                onClick={() => setOpen(false)}
              >
                Browse the catalogue
              </a>
            </div>
          ) : (
            <ul>
              {lines.map((line) => {
                const product = catalogue.find((entry) => entry.slug === line.slug);
                if (!product) return null;
                return (
                  <li key={line.slug} class="cart-line">
                    <a
                      href={\`/products/\${product.slug}\`}
                      class="block"
                      tabIndex={-1}
                      aria-hidden="true"
                      ${ROUTER_TRANSITION_SLIDE}
                    >
                      <img src={product.images[0]} alt="" loading="lazy" />
                    </a>
                    <div class="flex min-w-0 flex-col gap-3">
                      <div class="flex justify-between gap-3">
                        <div class="min-w-0">
                          <a
                            href={\`/products/\${product.slug}\`}
                            class="link block truncate text-[0.9375rem] font-medium"
                            ${ROUTER_TRANSITION_SLIDE}
                          >
                            {product.name}
                          </a>
                          <p class="mono mt-1 truncate text-[0.625rem] uppercase tracking-[0.05em] text-muted">
                            {product.material} · {product.finish}
                          </p>
                        </div>
                        <span class="mono shrink-0 text-[0.8125rem]">
                          {formatPrice(product.price * line.quantity)}
                        </span>
                      </div>
                      <div class="flex items-center justify-between gap-3">
                        <div class="qty qty-sm">
                          <button
                            type="button"
                            aria-label={\`Decrease \${product.name} quantity\`}
                            onClick={() => setLines(setLineQuantity(line.slug, line.quantity - 1))}
                          >
                            −
                          </button>
                          <output>{line.quantity}</output>
                          <button
                            type="button"
                            aria-label={\`Increase \${product.name} quantity\`}
                            onClick={() => setLines(setLineQuantity(line.slug, line.quantity + 1))}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          class="link link-mono text-muted"
                          onClick={() => setLines(removeFromCart(line.slug))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {lines.length > 0 ? (
          <div class="cart-panel-foot">
            <div class="flex items-baseline justify-between gap-4">
              <span class="label">Subtotal</span>
              <span class="mono text-lg">{formatPrice(subtotal)}</span>
            </div>
            <p class="mono mt-2 text-[0.625rem] uppercase tracking-[0.05em] text-muted">
              Delivery calculated at checkout
            </p>
            <a href="/cart" class="btn btn-primary mt-5 w-full" ${ROUTER_TRANSITION_SLIDE}>
              Checkout
            </a>
            <button type="button" class="link link-mono mx-auto mt-4 block text-muted" data-cart-close onClick={() => setOpen(false)}>
              Continue browsing
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
`;
}

function generateCatalogPage(): string {
	return `import CatalogBrowser from '@modules/store/components/CatalogBrowser.tsx';
import { getProductFilters, getProducts } from '@modules/store/lib/products.ts';
import { pageTitle, siteConfig } from '@modules/store/lib/site.ts';

export const metadata = {
  title: pageTitle('The Catalogue'),
  description: \`Browse every piece in the \${siteConfig.name} catalogue.\`,
};

export default async function CatalogPage() {
  const products = getProducts();
  const { categories, materials } = getProductFilters(products);

  return (
    <main id="main-content">
      <section class="shell pb-12 pt-12 md:pb-16 md:pt-20">
        <h1 class="type-h1 max-w-[12ch]">Every piece, made to order</h1>
        <p class="type-lead mt-8 max-w-[52ch]">
          Filter by category and material — then we begin by selecting the board.
        </p>
      </section>
      <div class="shell pb-32">
        <CatalogBrowser island={{ condition: 'on:idle' }} products={products} categories={categories} materials={materials} />
      </div>
    </main>
  );
}
`;
}

function generateCartPageClient(): string {
	return `import { useEffect, useMemo, useState } from 'preact/hooks';
import { readCart, removeFromCart, setLineQuantity } from '../lib/cart.ts';

export interface CartProductLine {
  slug: string;
  name: string;
  price: number;
  material: string;
  finish: string;
  leadTime: string;
  image: string;
}

interface Props {
  products: CartProductLine[];
  locale: string;
  currency: string;
  shippingFlatRate: number;
}

type CheckoutStep = 'selection' | 'details';

function formatMoney(value: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\\D/g, '').slice(0, maxLength);
}

function formatCardNumber(value: string): string {
  return digitsOnly(value, 16).replace(/(.{4})/g, '\\$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = digitsOnly(value, 4);
  return digits.length <= 2 ? digits : \`\${digits.slice(0, 2)} / \${digits.slice(2)}\`;
}

export default function CartPageClient({ products, locale, currency, shippingFlatRate }: Props) {
  const bySlug = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);
  const money = (value: number) => formatMoney(value, locale, currency);

  const [lines, setLines] = useState<ReturnType<typeof readCart>>([]);
  const [step, setStep] = useState<CheckoutStep>('selection');

  useEffect(() => {
    function sync(event?: Event) {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      setLines(Array.isArray(detail) ? detail : readCart());
    }
    sync();
    window.addEventListener('storefront:cart', sync);
    return () => window.removeEventListener('storefront:cart', sync);
  }, []);

  const rows = lines
    .map((line) => ({ line, product: bySlug.get(line.slug) }))
    .filter((row): row is { line: (typeof lines)[number]; product: CartProductLine } => Boolean(row.product));

  useEffect(() => {
    if (rows.length === 0) {
      setStep('selection');
    }
  }, [rows.length]);

  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.line.quantity, 0);
  const shipping = rows.length > 0 ? shippingFlatRate : 0;
  const total = subtotal + shipping;

  const title =
    rows.length === 0 ? 'Empty for now' : step === 'selection' ? 'Review your selection' : 'A few details';

  return (
    <>
      <header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-b border-line pb-8">
        <h1 class="type-h1">{title}</h1>
        <ol class="mono hidden gap-7 text-[0.6875rem] uppercase tracking-[0.05em] md:flex">
          <li class={step === 'selection' ? '' : 'text-muted'}>01 — Selection</li>
          <li class={step === 'details' ? '' : 'text-muted'}>02 — Details</li>
          <li class="text-muted">03 — Confirmation</li>
        </ol>
      </header>

      {rows.length === 0 ? (
        <div class="py-28 text-center">
          <p class="type-body mx-auto max-w-[42ch]">
            You haven't added any pieces yet. The catalogue is small, slow, and waiting.
          </p>
          <a href="/catalog" class="btn btn-primary mt-8" ${ROUTER_TRANSITION_SLIDE}>
            Browse the catalogue
          </a>
        </div>
      ) : (
        <div class="grid grid-cols-1 items-start gap-x-12 gap-y-12 pt-10 lg:grid-cols-12">
          <section class="lg:col-span-7" aria-label="Selected pieces">
            {step === 'selection' ? (
              <ul class="border-t border-line" aria-live="polite">
                {rows.map(({ line, product }) => (
                  <li key={line.slug} class="flex gap-6 border-b border-line py-6">
                    <a
                      href={\`/products/\${product.slug}\`}
                      class="block size-24 shrink-0 overflow-hidden bg-surface md:size-28"
                      tabIndex={-1}
                      aria-hidden="true"
                      ${ROUTER_TRANSITION_SLIDE}
                    >
                      <img src={product.image} alt="" class="size-full object-cover" loading="lazy" />
                    </a>
                    <div class="flex min-w-0 flex-1 flex-col justify-between gap-4">
                      <div class="flex justify-between gap-4">
                        <div class="min-w-0">
                          <a
                            href={\`/products/\${product.slug}\`}
                            class="link text-[0.9375rem] font-medium"
                            ${ROUTER_TRANSITION_SLIDE}
                          >
                            {product.name}
                          </a>
                          <p class="mono mt-1.5 text-[0.6875rem] uppercase tracking-[0.05em] text-muted">
                            {product.material} · {product.finish}
                          </p>
                          <p class="mono mt-1 text-[0.6875rem] uppercase tracking-[0.05em] text-muted">
                            Lead time {product.leadTime}
                          </p>
                        </div>
                        <span class="mono whitespace-nowrap text-[0.8125rem]">
                          {money(product.price * line.quantity)}
                        </span>
                      </div>
                      <div class="flex items-center justify-between gap-4">
                        <div class="qty qty-sm">
                          <button
                            type="button"
                            aria-label={\`Decrease \${product.name} quantity\`}
                            onClick={() => setLines(setLineQuantity(line.slug, line.quantity - 1))}
                          >
                            −
                          </button>
                          <output>{line.quantity}</output>
                          <button
                            type="button"
                            aria-label={\`Increase \${product.name} quantity\`}
                            onClick={() => setLines(setLineQuantity(line.slug, line.quantity + 1))}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          class="link link-mono text-muted"
                          onClick={() => setLines(removeFromCart(line.slug))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <form
                class="space-y-12"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                  }
                  window.alert('Checkout is a design preview — payment is not connected.');
                }}
              >
                <fieldset>
                  <legend class="label">Contact</legend>
                  <div class="mt-5">
                    <label class="field-label" htmlFor="checkout-email">
                      Email address
                    </label>
                    <input
                      id="checkout-email"
                      name="email"
                      type="email"
                      required
                      autocomplete="email"
                      placeholder="email@example.com"
                      class="field mono"
                    />
                  </div>
                </fieldset>
                <fieldset>
                  <legend class="label">Delivery</legend>
                  <div class="mt-5 grid gap-6 sm:grid-cols-2">
                    <div>
                      <label class="field-label" htmlFor="checkout-first">
                        First name
                      </label>
                      <input id="checkout-first" name="firstName" required autocomplete="given-name" class="field mono" />
                    </div>
                    <div>
                      <label class="field-label" htmlFor="checkout-last">
                        Last name
                      </label>
                      <input id="checkout-last" name="lastName" required autocomplete="family-name" class="field mono" />
                    </div>
                    <div class="sm:col-span-2">
                      <label class="field-label" htmlFor="checkout-address">
                        Street address
                      </label>
                      <input id="checkout-address" name="address" required autocomplete="street-address" class="field mono" />
                    </div>
                    <div>
                      <label class="field-label" htmlFor="checkout-city">
                        City
                      </label>
                      <input id="checkout-city" name="city" required autocomplete="address-level2" class="field mono" />
                    </div>
                    <div>
                      <label class="field-label" htmlFor="checkout-postcode">
                        Postcode
                      </label>
                      <input id="checkout-postcode" name="postalCode" required autocomplete="postal-code" class="field mono" />
                    </div>
                  </div>
                </fieldset>
                <fieldset>
                  <legend class="label">Payment</legend>
                  <div class="mt-5 grid gap-6 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                      <label class="field-label" htmlFor="checkout-card">
                        Card number
                      </label>
                      <input
                        id="checkout-card"
                        name="cardNumber"
                        required
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        class="field mono"
                        onInput={(event) => {
                          const input = event.currentTarget as HTMLInputElement;
                          input.value = formatCardNumber(input.value);
                        }}
                      />
                    </div>
                    <div>
                      <label class="field-label" htmlFor="checkout-expiry">
                        Expiry
                      </label>
                      <input
                        id="checkout-expiry"
                        name="cardExpiry"
                        required
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="08 / 28"
                        maxLength={7}
                        class="field mono"
                        onInput={(event) => {
                          const input = event.currentTarget as HTMLInputElement;
                          input.value = formatExpiry(input.value);
                        }}
                      />
                    </div>
                    <div>
                      <label class="field-label" htmlFor="checkout-cvc">
                        CVC
                      </label>
                      <input
                        id="checkout-cvc"
                        name="cardCvc"
                        required
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                        maxLength={3}
                        class="field mono"
                        onInput={(event) => {
                          const input = event.currentTarget as HTMLInputElement;
                          input.value = digitsOnly(input.value, 3);
                        }}
                      />
                    </div>
                  </div>
                </fieldset>
              </form>
            )}
          </section>

          <aside class="border-t border-line pt-6 lg:sticky lg:top-28 lg:col-span-5" aria-label="Order summary">
            <h2 class="label">Order summary</h2>
            <dl class="mono mt-6 text-[0.8125rem]">
              <div class="flex justify-between border-b border-line py-3">
                <dt class="text-muted">Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              <div class="flex justify-between border-b border-line py-3">
                <dt class="text-muted">White-glove delivery</dt>
                <dd>{money(shipping)}</dd>
              </div>
              <div class="flex items-baseline justify-between pt-5">
                <dt class="label">Total</dt>
                <dd class="mono text-2xl">{money(total)}</dd>
              </div>
            </dl>
            <button
              type="button"
              class="btn btn-primary mt-8 w-full"
              onClick={() => {
                if (step === 'selection') {
                  setStep('details');
                  return;
                }
                const form = document.querySelector('form');
                form?.requestSubmit();
              }}
            >
              {step === 'selection' ? 'Continue to details' : \`Reserve — \${money(total)}\`}
            </button>
            {step === 'details' ? (
              <button type="button" class="link link-mono mt-5 text-muted" onClick={() => setStep('selection')}>
                Back to selection
              </button>
            ) : null}
            <p class="type-body mt-8 border-t border-line pt-6 text-[0.8125rem]">
              Each piece is signed and dated. Pieces are wrapped in unbleached cotton and shipped in reusable wooden
              crates. Returned crates earn a small credit toward your next order.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
`;
}

function generateCartPage(): string {
	return `import CartPageClient from '@modules/store/components/CartPageClient.tsx';
import { getProducts } from '@modules/store/lib/products.ts';
import { pageTitle, siteConfig } from '@modules/store/lib/site.ts';

export const metadata = {
  title: pageTitle('Your cart'),
  description: \`Review the pieces you've selected from the \${siteConfig.name} catalogue.\`,
};

export default async function CartPage() {
  const cartProducts = getProducts().map((product) => ({
    slug: product.slug,
    name: product.name,
    price: product.price,
    material: product.material,
    finish: product.finish,
    leadTime: product.leadTime,
    image: product.images[0],
  }));

  return (
    <main id="main-content" class="shell py-12">
      <CartPageClient
        island={{ condition: 'on:client' }}
        products={cartProducts}
        locale={siteConfig.commerce.locale}
        currency={siteConfig.commerce.currency}
        shippingFlatRate={siteConfig.commerce.shippingFlatRate}
      />
    </main>
  );
}
`;
}

function generateAboutPage(): string {
	return `import { pageTitle, siteConfig } from '@modules/store/lib/site.ts';

const principles = [
  {
    heading: 'Solid wood, always',
    copy:
      'No MDF, no veneer, no engineered cores. Every surface you see and touch is the same piece of wood, all the way through.',
  },
  {
    heading: 'By hand, mostly',
    copy:
      'Machines mill and rough-cut. The joints, the surfaces and the finish are all worked by hand. It is slower. It shows.',
  },
  {
    heading: 'Made to be repaired',
    copy:
      'Hard-wax oils and natural soap finishes can be re-applied at home. Joints are mechanical, not glued shut. Nothing is disposable.',
  },
];

const studioFacts = [
  { value: '2018', label: 'Founded' },
  { value: '02', label: 'Makers' },
  { value: '03', label: 'Timbers' },
  { value: '4–10', label: 'Weeks lead time' },
];

export const metadata = {
  title: pageTitle('The Studio'),
  description: siteConfig.description,
};

export default async function AboutPage() {
  return (
    <main id="main-content">
      <section class="shell pb-12 pt-12 md:pb-16 md:pt-20">
        <h1 class="type-h1 hero-in max-w-[11ch]">A small workshop, made slowly</h1>
        <p class="type-lead hero-in mt-8 max-w-[58ch]" style="--reveal-delay:120ms">
          {siteConfig.name} is a two-person furniture workshop in {siteConfig.location.region},{' '}
          {siteConfig.location.country}. We design and build a small catalogue of seating and tables — by hand, to
          order, in solid wood. No factory, no veneers, no rush.
        </p>
      </section>

      <figure class="hero-in overflow-hidden bg-surface" style="--reveal-delay:260ms">
        <img
          src="/media/atelier-workshop.jpg"
          alt="Sunlit woodworking atelier with hand tools and a half-finished chair"
          width={1920}
          height={1080}
          class="parallax h-[50vh] w-full object-cover md:h-[72vh]"
        />
      </figure>

      <section class="shell mt-24 grid gap-8 md:mt-36 md:grid-cols-12">
        <div class="md:col-span-5" data-reveal>
          <h2 class="type-h2 max-w-[12ch]">We started with one chair</h2>
        </div>
        <div class="md:col-span-6 md:col-start-7" data-reveal style="--reveal-delay:120ms">
          <p class="type-body">
            The workshop began in a borrowed barn with a single steam-bent ash chair — the piece that became the
            Arvid. Years later, we still work in solid wood only, still build to order, and still sign every piece
            on the underside before it leaves.
          </p>
          <p class="type-body mt-5">{siteConfig.footerBlurb}</p>
        </div>
      </section>

      <section class="shell mt-24 md:mt-36">
        <div class="rule" data-reveal="line" />
        <h2 class="type-h2 mt-8 max-w-[16ch]" data-reveal>How we work</h2>
        <div class="mt-12 grid gap-x-8 gap-y-12 md:grid-cols-3">
          {principles.map((principle, index) => (
            <div
              key={principle.heading}
              class="border-t border-line pt-6"
              data-reveal
              style={\`--reveal-delay:\${index * 110}ms\`}
            >
              <h3 class="type-h3">{principle.heading}</h3>
              <p class="type-body mt-4 text-[0.9375rem]">{principle.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="shell mt-24 grid items-center gap-10 md:mt-36 md:grid-cols-12 md:gap-12">
        <div class="md:col-span-5">
          <div class="overflow-hidden bg-surface" data-reveal="mask">
            <div>
              <img
                src="/media/atelier-hands.jpg"
                alt="Close-up of a craftsman's hands planing a piece of pale oak"
                width={1080}
                height={1440}
                loading="lazy"
                class="aspect-[3/4] w-full object-cover"
              />
            </div>
          </div>
        </div>
        <div class="md:col-span-6 md:col-start-7" data-reveal style="--reveal-delay:140ms">
          <blockquote>
            <p class="type-h3 max-w-[26ch] text-[clamp(1.5rem,2.8vw,2.25rem)] leading-[1.15]">
              We do not buy lumber by the pallet. Every board is chosen for the piece it will become — sometimes
              months before it is cut.
            </p>
            <footer class="label mt-6">Workshop note</footer>
          </blockquote>
          <p class="type-body mt-8 max-w-[48ch] border-t border-line pt-6 text-[0.9375rem]">
            European oak from managed forests. Curved ash from a small reserve on the south coast. American walnut from
            a family mill. Three woods. No more.
          </p>
        </div>
      </section>

      <section class="mt-24 border-y border-line md:mt-36" aria-label="Studio at a glance">
        <dl class="shell grid grid-cols-2 md:grid-cols-4">
          {studioFacts.map((fact, index) => (
            <div key={fact.label} class="fact" data-reveal style={\`--reveal-delay:\${index * 70}ms\`}>
              <dt class="label">{fact.label}</dt>
              <dd class="mt-2.5 text-2xl font-medium tracking-[-0.03em] md:text-3xl">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="studio" class="shell mt-24 md:mt-36">
        <div class="grid items-end gap-8 md:grid-cols-12" data-reveal>
          <div class="md:col-span-7">
            <h2 class="type-h2 max-w-[16ch]">Visit the workshop, or begin with a piece</h2>
          </div>
          <div class="flex flex-wrap gap-3 md:col-span-5 md:justify-end">
            <a href="/catalog" class="btn btn-primary" ${ROUTER_TRANSITION_SLIDE}>
              See the catalogue
            </a>
            <a href={\`mailto:\${siteConfig.email}\`} class="btn btn-outline">
              Write to us
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
`;
}

function generateProductDetailPage(): string {
	return `import AddToCartButton from '@modules/store/components/AddToCartButton.tsx';
import { formatPrice, getProduct } from '@modules/store/lib/products.ts';

type PageContext = { params: Record<string, string> };

export async function getServerSideProps(context: PageContext) {
  return { slug: context.params.slug ?? '' };
}

interface PageProps {
  slug: string;
}

export default async function ProductPage({ slug }: PageProps) {
  const product = getProduct(slug);
  if (!product) {
    return (
      <main class="shell py-24">
        <h1 class="type-h2">Piece not found</h1>
      </main>
    );
  }

  return (
    <main id="main-content" class="shell py-12 md:py-16">
      <div class="grid gap-12 lg:grid-cols-12">
        <div class="lg:col-span-7">
          <img src={product.images[0]} alt="" class="w-full bg-surface object-cover" />
        </div>
        <div class="lg:col-span-5">
          <p class="label">{product.collection}</p>
          <h1 class="type-h2 mt-4">{product.name}</h1>
          <p class="mono mt-4 text-lg">{formatPrice(product.price)}</p>
          <p class="type-body mt-6">{product.description || product.shortDescription}</p>
          <dl class="mono mt-8 grid gap-3 text-[0.8125rem]">
            <div class="flex justify-between border-b border-line py-2">
              <dt class="text-muted">Dimensions</dt>
              <dd>{product.dimensions}</dd>
            </div>
            <div class="flex justify-between border-b border-line py-2">
              <dt class="text-muted">Finish</dt>
              <dd>{product.finish}</dd>
            </div>
            <div class="flex justify-between border-b border-line py-2">
              <dt class="text-muted">Lead time</dt>
              <dd>{product.leadTime}</dd>
            </div>
          </dl>
          <AddToCartButton island={{ condition: 'on:interaction' }} slug={product.slug} />
        </div>
      </div>
    </main>
  );
}

`;
}

function generateAddToCartButton(): string {
	return `import { addToCart } from '../lib/cart.ts';

interface Props {
  slug: string;
}

export default function AddToCartButton({ slug }: Props) {
  return (
    <button type="button" class="btn btn-primary mt-10 w-full sm:w-auto" onClick={() => addToCart(slug, 1)}>
      Add to cart
    </button>
  );
}
`;
}

function generateProductJsonFiles(storeDir: string): Promise<void>[] {
	const products = [
		{
			file: "arvid-chair.json",
			body: {
				name: "Arvid Chair",
				collection: "Collection 01 — Seating",
				category: "Seating",
				material: "Ash",
				price: 840,
				shortDescription: "Curved ash shell",
				description:
					"A single sculpted shell of steam-bent ash, shaped over a custom form and finished in the workshop.",
				dimensions: "W 54 × D 56 × H 92 cm",
				finish: "Soap-treated",
				leadTime: "6–8 weeks",
				images: ["/media/p-arvid-1.jpg", "/media/p-arvid-2.jpg"],
				order: 1,
			},
		},
		{
			file: "tora-desk.json",
			body: {
				name: "Tora Desk",
				collection: "Collection 02 — Tables",
				category: "Tables",
				material: "Oak",
				price: 1240,
				shortDescription: "Writing surface",
				description: "A compact writing desk with a single drawer and oiled oak top.",
				dimensions: "W 110 × D 58 × H 74 cm",
				finish: "Oiled",
				leadTime: "8–10 weeks",
				images: ["/media/p-tora-1.jpg"],
				order: 2,
			},
		},
	];

	return products.map(({ file, body }) =>
		writeFile(join(storeDir, "content/products", file), `${JSON.stringify(body, null, 2)}\n`),
	);
}

export function generateStorefrontHomePage(config: ProjectConfig): string {
	return jsxForCore(
		config.core,
		`import ProductCard from '@modules/store/components/ProductCard.tsx';
import { formatPrice, getProducts, requireProduct } from '@modules/store/lib/products.ts';
import { siteConfig } from '@modules/store/lib/site.ts';

const workshopMaterials = [
  {
    name: 'European Oak',
    tag: 'Quiet · structural',
    copy:
      'A single grade of slow-grown oak from managed forests. Quarter-sawn for stability.',
  },
  {
    name: 'Curved Ash',
    tag: 'Resilient · sprung',
    copy: 'A small reserve from the south coast, steam-bent over custom forms. Used only where the curve earns it.',
  },
  {
    name: 'American Walnut',
    tag: 'Warm · figured',
    copy: 'Bought in single planks from a family mill. The grain decides the piece, not the reverse.',
  },
];

export const metadata = {
  title: siteConfig.defaultTitle,
  description: siteConfig.description,
};

export default async function HomePage() {
  const products = getProducts();
  const featured = siteConfig.featured.homepageGrid.map((slug) => requireProduct(products, slug));
  const solo = requireProduct(products, siteConfig.featured.homepageSolo);

  const facts = [
    { value: '2018', label: 'Founded' },
    { value: siteConfig.location.region, label: siteConfig.location.country },
    { value: String(products.length).padStart(2, '0'), label: 'Pieces' },
    { value: '03', label: 'Timbers' },
  ];

  return (
    <main id="main-content">
      <section class="shell grid items-center gap-x-12 gap-y-10 pb-4 pt-8 md:grid-cols-12 md:pb-10 md:pt-12">
        <div class="hero-in md:col-span-5">
          <h1 class="type-hero">Hand-carved pieces from the northern woods</h1>
          <p class="type-lead mt-7 max-w-[42ch]">
            A small, slow catalogue of seating and tables — solid oak, ash and walnut, shaped by hand and built to
            outlast the room they were made for.
          </p>
          <div class="mt-9 flex flex-wrap gap-3">
            <a href="/catalog" class="btn btn-primary" ${ROUTER_TRANSITION_SLIDE}>
              Browse the catalogue
            </a>
            <a href="/about" class="btn btn-outline" ${ROUTER_TRANSITION_SLIDE}>
              The workshop
            </a>
          </div>
        </div>
        <figure class="hero-in md:col-span-7" style="--reveal-delay:120ms">
          <div class="overflow-hidden bg-surface">
            <img
              src="/media/atelier-hero.jpg"
              alt="Hand-carved sculptural lounge chair in a sunlit atelier"
              width={1600}
              height={1400}
              class="parallax aspect-[4/3] w-full object-cover object-right md:aspect-[8/7]"
            />
          </div>
          <figcaption class="mono mt-3 flex justify-between gap-4 text-[0.625rem] uppercase tracking-[0.05em] text-muted">
            <span>No. 04 — Arvid Lounge</span>
            <span>Solid walnut · 2025</span>
          </figcaption>
        </figure>
      </section>

      <div class="mt-14 border-y border-line md:mt-20">
        <dl class="shell grid grid-cols-2 md:grid-cols-4">
          {facts.map((fact, index) => (
            <div key={fact.label} class="fact" data-reveal style={\`--reveal-delay:\${index * 70}ms\`}>
              <dt class="label">{fact.label}</dt>
              <dd class="mt-2.5 text-2xl font-medium tracking-[-0.03em] md:text-3xl">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section class="shell mt-24 md:mt-36">
        <div class="rule" data-reveal="line" />
        <div class="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4" data-reveal>
          <h2 class="type-h2 max-w-[14ch]">A few pieces, close to ready</h2>
          <a href="/catalog" class="link link-mono pb-1.5 text-muted" ${ROUTER_TRANSITION_SLIDE}>
            All {products.length} pieces
          </a>
        </div>
        <div class="mt-12 grid gap-x-8 gap-y-14 md:mt-14 md:grid-cols-3">
          {featured.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      <section class="mt-24 md:mt-36">
        <div class="shell grid items-center gap-10 md:grid-cols-12 md:gap-12">
          <div class="md:col-span-7 lg:col-span-8">
            <a
              href={\`/products/\${solo.slug}\`}
              class="group block overflow-hidden bg-surface"
              data-reveal="mask"
              aria-label={\`\${solo.name} — \${solo.shortDescription}\`}
              ${ROUTER_TRANSITION_SLIDE}
            >
              <div>
                <img
                  src={solo.images[0]}
                  alt=""
                  width={1600}
                  height={1100}
                  loading="lazy"
                  class="aspect-[5/4] w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.04] md:aspect-[16/11]"
                />
              </div>
            </a>
          </div>
          <div class="md:col-span-5 lg:col-span-4" data-reveal style="--reveal-delay:140ms">
            <h2 class="type-h2">One plank, no hardware</h2>
            <p class="type-body mt-6 max-w-[44ch]">{solo.description || solo.shortDescription}</p>
            <dl class="mono mt-9 border-t border-line text-[0.8125rem]">
              <div class="flex justify-between gap-6 border-b border-line py-3">
                <dt class="text-muted">Dimensions</dt>
                <dd class="text-right">{solo.dimensions}</dd>
              </div>
              <div class="flex justify-between gap-6 border-b border-line py-3">
                <dt class="text-muted">Finish</dt>
                <dd class="text-right">{solo.finish}</dd>
              </div>
              <div class="flex justify-between gap-6 border-b border-line py-3">
                <dt class="text-muted">Lead time</dt>
                <dd class="text-right">{solo.leadTime}</dd>
              </div>
              <div class="flex justify-between gap-6 border-b border-line py-3">
                <dt class="text-muted">From</dt>
                <dd class="text-right">{formatPrice(solo.price)}</dd>
              </div>
            </dl>
            <a href={\`/products/\${solo.slug}\`} class="btn btn-primary mt-9" ${ROUTER_TRANSITION_SLIDE}>
              See the piece
            </a>
          </div>
        </div>
      </section>

      <section class="shell mt-24 md:mt-36">
        <div class="rule" data-reveal="line" />
        <h2 class="type-h2 mt-8 max-w-[18ch]" data-reveal>We have spent years learning three timbers</h2>
        <div class="mt-12 grid gap-x-8 gap-y-12 md:grid-cols-3">
          {workshopMaterials.map((material, index) => (
            <div
              key={material.name}
              class="border-t border-line pt-6"
              data-reveal
              style={\`--reveal-delay:\${index * 110}ms\`}
            >
              <h3 class="type-h3">{material.name}</h3>
              <p class="label mt-3">{material.tag}</p>
              <p class="type-body mt-4 text-[0.9375rem]">{material.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
	);
}
