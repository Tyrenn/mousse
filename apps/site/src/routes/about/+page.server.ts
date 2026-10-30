import { highlight } from '#lib/server/content.ts';

// Quoted from the README of Tyrenn/helice
const heliceExample = `db.select('post').where({ published: true }).build();
// { query, args }`;

// The contributing steps of the README
const setup = `git clone https://github.com/<you>/mousse
cd mousse && pnpm install
git checkout -b my-change`;

const check = 'pnpm build && pnpm check-types && pnpm test';

const changeset = 'pnpm changeset';

export function load(){
	return {
		helice : highlight(heliceExample, 'ts'),
		contributing : {
			setup : highlight(setup, 'sh'),
			check : highlight(check, 'sh'),
			changeset : highlight(changeset, 'sh')
		}
	};
}
