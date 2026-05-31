import { Image } from "@useavalon/avalon/client";
// Simple single-size import - returns a string URL
import thumbImage from "../assets/image.png?w=200&format=webp";

// With &as=srcset - returns a srcset string (recommended for responsive images)
import heroSrcset from "../assets/image.png?w=400;800;1200&format=webp&as=srcset";
import styles from "./index.module.css";

export default function ImageTestPage() {
	return (
		<div class={styles.container}>
			<div class={styles.pageHeader}>
				<h1 class={styles.pageTitle}>Image Optimization Test</h1>
				<p class={styles.pageSubtitle}>Testing vite-imagetools integration with Avalon</p>
			</div>

			<section style={{ marginBottom: "2rem" }}>
				<h2>Responsive Image with srcset</h2>
				<p>
					Using the Image component with a srcset string from <code>?as=srcset</code>:
				</p>
				<Image
					src={heroSrcset}
					sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
					alt="Test image with srcset"
					style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
				/>
				<pre
					style={{
						background: "#1a1a2e",
						padding: "1rem",
						borderRadius: "4px",
						overflow: "auto",
						marginTop: "1rem",
					}}
				>
					{`heroSrcset = "${heroSrcset}"`}
				</pre>
			</section>

			<section style={{ marginBottom: "2rem" }}>
				<h2>Single Optimized Image</h2>
				<p>Using the Image component with a single URL:</p>
				<Image src={thumbImage} alt="Thumbnail test" width={200} style={{ borderRadius: "8px" }} />
				<pre
					style={{ background: "#1a1a2e", padding: "1rem", borderRadius: "4px", marginTop: "1rem" }}
				>
					{`thumbImage = "${thumbImage}"`}
				</pre>
			</section>

			<section>
				<h2>Usage</h2>
				<code
					style={{
						display: "block",
						background: "#1a1a2e",
						padding: "1rem",
						borderRadius: "4px",
						whiteSpace: "pre",
					}}
				>
					{`import { Image } from '@useavalon/avalon/client';

// Single optimized image
import thumb from './photo.png?w=200&format=webp';
<Image src={thumb} alt="Thumbnail" />

// Responsive with srcset
import hero from './photo.png?w=400;800;1200&format=webp&as=srcset';
<Image
  src={hero}
  sizes="(max-width: 600px) 400px, 800px"
  alt="Hero"
/>`}
				</code>
			</section>
		</div>
	);
}
