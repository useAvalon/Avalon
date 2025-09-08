import type { JSX } from 'preact';
import { z } from 'zod';
import { IslandPropsSchema, ComponentMetadataSchema } from './core.ts';
import { ImportConfigSchema } from './core.ts';

// === Preact Schemas ===

/**
 * Schema for Preact component function validation
 * Note: We can't validate the actual function implementation with Zod,
 * but we can validate that it's a function
 */
export const PreactComponentFunctionSchema: z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodAny> = z
	.function()
	.returns(z.any());

/**
 * Schema for Preact component with metadata
 */
export const PreactComponentWithMetadataSchema: z.ZodIntersection<
	z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodAny>,
	z.ZodObject<{
		imports: z.ZodOptional<
			z.ZodArray<
				z.ZodObject<{
					names: z.ZodArray<z.ZodString, 'many'>;
					from: z.ZodString;
				}>,
				'many'
			>
		>;
		displayName: z.ZodOptional<z.ZodString>;
	}>
> = PreactComponentFunctionSchema.and(
	z.object({
		imports: ComponentMetadataSchema.shape.imports,
		displayName: ComponentMetadataSchema.shape.displayName,
	})
);

/**
 * Schema for Preact component props (can be any record)
 */
export const PreactPropsSchema: z.ZodRecord<z.ZodString, z.ZodUnknown> = z.record(z.unknown());

/**
 * Schema for Preact island props
 */
export const PreactIslandPropsSchema: z.ZodSchema = IslandPropsSchema.extend({
	component: PreactComponentFunctionSchema, // Revert: Use basic schema, handle metadata separately
	props: PreactPropsSchema.optional(),
}).strict();

// Derived TypeScript types
export type PreactProps = z.infer<typeof PreactPropsSchema>;
export type PreactComponentFunction<Props = PreactProps> = (props: Props) => JSX.Element;
export type PreactComponentWithMetadata<Props = PreactProps> = PreactComponentFunction<Props> & {
	imports?: import('./core.ts').ImportConfig[];
	displayName?: string;
};
export type PreactIslandProps<Props = PreactProps> = Omit<
	z.infer<typeof PreactIslandPropsSchema>,
	'component' | 'props'
> & {
	component: PreactComponentFunction<Props>;
	props?: Props;
};

// === Solid Schemas ===

/**
 * Schema for Solid component function validation
 * Solid components return a function that returns JSX
 */
export const SolidPropsSchema: z.ZodRecord<z.ZodString, z.ZodUnknown> = z.record(z.unknown());

export const SolidComponentFunctionSchema: z.ZodFunction<
	z.ZodTuple<[z.ZodOptional<typeof SolidPropsSchema>], z.ZodUnknown>,
	z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodAny>
> = z.function().args(SolidPropsSchema.optional()).returns(z.function().returns(z.any()));

/**
 * Schema for Solid component with metadata
 */
export const SolidComponentWithMetadataSchema: z.ZodIntersection<
	z.ZodFunction<
		z.ZodTuple<[z.ZodOptional<typeof SolidPropsSchema>], z.ZodUnknown>,
		z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodAny>
	>,
	z.ZodObject<{
		imports: z.ZodOptional<
			z.ZodArray<
				z.ZodObject<{
					names: z.ZodArray<z.ZodString, 'many'>;
					from: z.ZodString;
				}>,
				'many'
			>
		>;
		displayName: z.ZodOptional<z.ZodString>;
	}>
> = SolidComponentFunctionSchema.and(
	z.object({
		imports: ComponentMetadataSchema.shape.imports,
		displayName: ComponentMetadataSchema.shape.displayName,
	})
);

/**
 * Schema for Solid island props
 */
export const SolidIslandPropsSchema: z.ZodSchema = z
	.object({
		component: SolidComponentFunctionSchema, // Revert: Use basic schema, handle metadata separately
		imports: z.array(ImportConfigSchema).optional(),
		props: SolidPropsSchema.optional(),
	})
	.strict();

// === Vue Schemas ===

/**
 * Schema for Vue component structure (function-based)
 */
export const VueComponentFunctionSchema: z.ZodFunction<
	z.ZodTuple<[], z.ZodUnknown>,
	z.ZodObject<{
		setup: z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodRecord<z.ZodString, z.ZodAny>>;
		template: z.ZodString;
	}>
> = z.function().returns(
	z.object({
		setup: z.function().returns(z.record(z.any())),
		template: z.string().min(1),
	})
);

/**
 * Schema for Vue SFC file path
 */
export const VueSFCPathSchema: z.ZodObject<{
	__vueSFC: z.ZodLiteral<true>;
	path: z.ZodString;
}> = z.object({
	__vueSFC: z.literal(true),
	path: z.string().min(1).endsWith('.vue'),
});

/**
 * Schema for Vue component (either function or SFC path)
 */
export const VueComponentSchema: z.ZodUnion<[typeof VueComponentFunctionSchema, typeof VueSFCPathSchema]> = z.union([
	VueComponentFunctionSchema,
	VueSFCPathSchema,
]);

/**
 * Schema for Vue function component with metadata
 */
export const VueComponentWithMetadataSchema: z.ZodIntersection<
	z.ZodFunction<
		z.ZodTuple<[], z.ZodUnknown>,
		z.ZodObject<{
			setup: z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodRecord<z.ZodString, z.ZodAny>>;
			template: z.ZodString;
		}>
	>,
	z.ZodObject<{
		imports: z.ZodOptional<
			z.ZodArray<
				z.ZodObject<{
					names: z.ZodArray<z.ZodString, 'many'>;
					from: z.ZodString;
				}>,
				'many'
			>
		>;
		displayName: z.ZodOptional<z.ZodString>;
	}>
> = VueComponentFunctionSchema.and(
	z.object({
		imports: ComponentMetadataSchema.shape.imports,
		displayName: ComponentMetadataSchema.shape.displayName,
	})
);

/**
 * Schema for Vue component props (can be any record)
 */
export const VuePropsSchema: z.ZodRecord<z.ZodString, z.ZodUnknown> = z.record(z.unknown());

/**
 * Schema for Vue island props
 */
export const VueIslandPropsSchema: z.ZodSchema = z
	.object({
		component: VueComponentSchema, // Revert: Use basic schema, handle metadata separately
		props: VuePropsSchema.optional(),
		imports: z.array(ImportConfigSchema).optional(),
	})
	.strict();

// === Vanilla Schemas ===

/**
 * Schema for vanilla component props (can be any record)
 */
export const VanillaPropsSchema: z.ZodRecord<z.ZodString, z.ZodUnknown> = z.record(z.unknown());

/**
 * Schema for vanilla component function
 * Note: We can't validate HTMLElement on the server, so we use a more general approach
 */
export const VanillaComponentFunctionSchema: z.ZodFunction<
	z.ZodTuple<[z.ZodAny, z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>], z.ZodUnknown>,
	z.ZodUnion<[z.ZodUndefined, z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodVoid>]>
> = z
	.function()
	.args(z.any(), VanillaPropsSchema.optional()) // First arg should be HTMLElement, but we can't validate it on server
	.returns(z.union([z.undefined(), z.function().returns(z.void())]));

/**
 * Schema for template function
 */
export const TemplateFunctionSchema: z.ZodFunction<
	z.ZodTuple<[z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>], z.ZodUnknown>,
	z.ZodString
> = z.function().args(VanillaPropsSchema.optional()).returns(z.string());

/**
 * Schema for templated vanilla component
 */
export const TemplatedVanillaComponentSchema: z.ZodIntersection<
	typeof VanillaComponentFunctionSchema,
	z.ZodObject<{
		template: typeof TemplateFunctionSchema;
	}>
> = VanillaComponentFunctionSchema.and(
	z.object({
		template: TemplateFunctionSchema,
	})
);

/**
 * Schema for vanilla component with metadata
 */
export const VanillaComponentWithMetadataSchema: z.ZodIntersection<
	typeof TemplatedVanillaComponentSchema,
	z.ZodObject<{
		imports: z.ZodOptional<
			z.ZodArray<
				z.ZodObject<{
					names: z.ZodArray<z.ZodString, 'many'>;
					from: z.ZodString;
				}>,
				'many'
			>
		>;
		displayName: z.ZodOptional<z.ZodString>;
		template: typeof TemplateFunctionSchema;
	}>
> = TemplatedVanillaComponentSchema.and(
	z.object({
		imports: ComponentMetadataSchema.shape.imports,
		displayName: ComponentMetadataSchema.shape.displayName,
		template: TemplateFunctionSchema,
	})
);

/**
 * Schema for vanilla component options
 */
export const VanillaComponentOptionsSchema: z.ZodObject<{
	imports: z.ZodOptional<
		z.ZodArray<
			z.ZodObject<{
				names: z.ZodArray<z.ZodString, 'many'>;
				from: z.ZodString;
			}>,
			'many'
		>
	>;
}> = z.object({
	imports: ComponentMetadataSchema.shape.imports,
});

/**
 * Schema for vanilla island props
 */
export const VanillaIslandPropsSchema: z.ZodSchema = IslandPropsSchema.extend({
	component: VanillaComponentFunctionSchema, // Revert: Use basic schema, handle metadata separately
	props: VanillaPropsSchema.default({}),
}).strict();

export type SolidComponentFunction<ReturnType = unknown, Props = z.infer<typeof SolidPropsSchema>> = (
	props?: Props
) => () => ReturnType;
export type SolidComponentWithMetadata = z.infer<typeof SolidComponentWithMetadataSchema>;
export type SolidIslandProps<Props = z.infer<typeof SolidPropsSchema>> = Omit<
	z.infer<typeof SolidIslandPropsSchema>,
	'component' | 'props'
> & {
	component: SolidComponentFunction<JSX.Element, Props>;
	props?: Props;
};

export type VueProps = z.infer<typeof VuePropsSchema>;
export type VueComponentFunction = z.infer<typeof VueComponentFunctionSchema>;
export type VueSFCPath = z.infer<typeof VueSFCPathSchema>;
export type VueComponent = z.infer<typeof VueComponentSchema>;
export type VueComponentWithMetadata = z.infer<typeof VueComponentWithMetadataSchema>;
export type VueIslandProps<Props = VueProps> = Omit<z.infer<typeof VueIslandPropsSchema>, 'component' | 'props'> & {
	component: VueComponent;
	props?: Props;
};

export type VanillaProps = z.infer<typeof VanillaPropsSchema>;
export type VanillaComponentFunction<Props = VanillaProps> = (
	container: HTMLElement,
	props?: Props
) => void | (() => void);
export type TemplateFunction<Props = VanillaProps> = (props?: Props) => string;
export type TemplatedVanillaComponent<Props = VanillaProps> = VanillaComponentFunction<Props> & {
	template: TemplateFunction<Props>;
};
export type VanillaComponentWithMetadata<Props = VanillaProps> = VanillaComponentFunction<Props> & {
	imports?: import('./core.ts').ImportConfig[];
	displayName?: string;
	template: TemplateFunction<Props>;
};
export type VanillaComponentOptions = z.infer<typeof VanillaComponentOptionsSchema>;
export type VanillaIslandProps<Props = VanillaProps> = Omit<
	z.infer<typeof VanillaIslandPropsSchema>,
	'component' | 'props'
> & {
	component: VanillaComponentFunction<Props>;
	props?: Props;
};

/**
 * Validation helpers
 */
export const validatePreactIslandProps = (data: unknown): PreactIslandProps => {
	return PreactIslandPropsSchema.parse(data);
};

export const validateSolidIslandProps = (data: unknown): SolidIslandProps => {
	return SolidIslandPropsSchema.parse(data);
};

export const validateVueIslandProps = (data: unknown): VueIslandProps => {
	return VueIslandPropsSchema.parse(data);
};

export const validateVanillaIslandProps = (data: unknown): VanillaIslandProps => {
	return VanillaIslandPropsSchema.parse(data) as unknown as VanillaIslandProps;
};

export const validateVanillaComponentOptions = (data: unknown): VanillaComponentOptions => {
	return VanillaComponentOptionsSchema.parse(data);
};
