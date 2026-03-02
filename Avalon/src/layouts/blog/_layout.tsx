import type { LayoutProps } from '@avalon/avalon';

export default function BlogLayout({ children }: Readonly<LayoutProps>) {
	return (
		<div>
			{children}
		</div>
	);
}
