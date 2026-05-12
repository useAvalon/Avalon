import DesignSystemIsland from "../components/DesignSystemIsland.tsx";

export const metadata = {
	title: "Avalon Design System",
	description:
		"Avalon design system — palette, gradients, patterns, tokens, and light/dark themes.",
};

export default async function DesignSystemPage() {
	return (
		<div>
			<DesignSystemIsland island={{ condition: "on:client" }} />
		</div>
	);
}
