import { resolve } from '$app/paths';

// Pages end with a slash, see routes/+layout.ts
export const docHref = (slug : string, hash : string = '') => `${resolve('/docs/[slug]', {slug})}/${hash}`;
