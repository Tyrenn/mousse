import { highlight } from '#lib/server/content.ts';

// The monorepo commands of the README
const explore = `pnpm example            # list runnable examples
pnpm example schemas    # run one on http://localhost:8080
pnpm site               # run this site locally`;

// The contributing steps of the README
const setup = `git clone https://github.com/<you>/mousse
cd mousse && pnpm install
git checkout -b my-change`;

const check = 'pnpm build && pnpm check-types && pnpm test';

const changeset = 'pnpm changeset';

export function load(){
	return {
		explore : highlight(explore, 'sh'),
		contributing : {
			setup : highlight(setup, 'sh'),
			check : highlight(check, 'sh'),
			changeset : highlight(changeset, 'sh')
		}
	};
}
