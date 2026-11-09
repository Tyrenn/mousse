<script lang="ts">
	let {data} = $props();

	const REPO = 'https://github.com/Tyrenn/mousse';
	const INDEX = 'https://tyrenn.github.io/';
	const SPONSOR = 'https://github.com/sponsors/Tyrenn';

	const ways = [
		{
			title : 'Report a bug',
			text : 'Something breaks, or behaves unlike the docs say ? An issue with a minimal reproduction is the most useful help.',
			href : `${REPO}/issues/new`,
			label : 'Open an issue'
		},
		{
			title : 'Suggest a feature',
			text : 'A missing module, a rough API, a use case Mousse does not cover yet : describe it in an issue before writing code.',
			href : `${REPO}/issues`,
			label : 'Browse issues'
		},
		{
			title : 'Improve the docs',
			text : 'This site is built from the README and the docs folder. A typo fix or a clearer example is a welcome pull request.',
			href : `${REPO}/tree/main/docs`,
			label : 'docs/'
		}
	];

	const layout = [
		{path : 'packages/mousse', text : 'The framework, with its unit tests'},
		{path : 'apps/examples', text : 'Runnable examples and the integration tests'},
		{path : 'apps/benchmarks', text : 'Benchmarks against express, fastify and raw µWebSockets.js'},
		{path : 'apps/site', text : 'This site, built from the README and docs/'}
	];
</script>

<svelte:head>
	<title>About : Mousse</title>
	<meta name="description" content="Mousse is open source and maintained on a volunteer basis. How to sponsor it, report bugs, suggest features, improve the docs and contribute code." />
</svelte:head>

<main class="page">
	<h1>About</h1>
	<p class="lead">
		Mousse is an open source, MIT licensed project, maintained on a volunteer basis. It draws heavily on its peers, such as Express,
		Fastify and Koa. Every bug report, idea and pull request helps it grow.
	</p>

	<h2 class="more" id="support">Support</h2>
	<div class="support">
		<a class="card sponsor" href={SPONSOR}>
			<span class="heart" aria-hidden="true">♥</span>
			<strong>Sponsor Mousse</strong>
			<span class="muted">Sponsoring on GitHub buys time to maintain Mousse, fix bugs and write new modules.</span>
			<span class="cta">github.com/sponsors/Tyrenn <span class="arrow" aria-hidden="true">→</span></span>
		</a>
		<a class="card" href={INDEX}>
			<span class="heart" aria-hidden="true">✦</span>
			<strong>More projects</strong>
			<span class="muted">Mousse is one of several open source tools by Tyren : a query builder, Svelte components, and more.</span>
			<span class="cta">tyrenn.github.io <span class="arrow" aria-hidden="true">→</span></span>
		</a>
	</div>

	<h2 class="more">Ways to help</h2>
	<div class="ways">
		{#each ways as way (way.title)}
			<section>
				<h3>{way.title}</h3>
				<p>{way.text}</p>
				<a href={way.href}>{way.label}</a>
			</section>
		{/each}
	</div>

	<h2 class="more">Find your way around</h2>
	<p class="intro">
		<a href={REPO}>The repository</a> is a pnpm monorepo driven by turbo :
	</p>
	<dl class="layout">
		{#each layout as entry (entry.path)}
			<dt><a href="{REPO}/tree/main/{entry.path}"><code>{entry.path}</code></a></dt>
			<dd>{entry.text}</dd>
		{/each}
	</dl>
	<div class="code"><pre>{@html data.explore}</pre></div>

	<h2 class="more" id="contributing">Contributing code</h2>
	<ol class="steps">
		<li>
			<strong>Fork</strong> <a href={REPO}>the repository</a> and create a branch from <code>main</code>.
			<div class="code"><pre>{@html data.contributing.setup}</pre></div>
		</li>
		<li>
			<strong>Make your change</strong>, with tests : an integration test in
			<a href="{REPO}/tree/main/apps/examples/tests"><code>apps/examples/tests</code></a> for a new feature, a unit test in
			<a href="{REPO}/tree/main/packages/mousse/tests"><code>packages/mousse/tests</code></a> for pure logic. Then check everything locally.
			<div class="code"><pre>{@html data.contributing.check}</pre></div>
		</li>
		<li>
			<strong>Record your change</strong> with a changeset. It describes the change and the version bump it deserves, and ends up in the changelog.
			Answer the prompts, then commit the generated <code>.changeset/*.md</code> file with your change.
			<div class="code"><pre>{@html data.contributing.changeset}</pre></div>
		</li>
		<li>
			<strong>Open a pull request</strong> against <code>main</code>. CI runs the build, the types and the full test suites.
		</li>
	</ol>
</main>

<style>
	/* A single reading column, centered by .page */
	main{
		--page : 52rem;
		padding-block : clamp(40px, 6vw, 72px);
	}

	h1{
		font-size : clamp(2.2rem, 5vw, 3rem);
	}

	.lead{
		margin : 16px 0 0;
		font-size : 1.1rem;
	}

	h2{
		font-size : 1.6rem;
	}

	h3{
		margin : 0 0 8px;
		font-size : 1.15rem;
	}

	.more{
		margin-block : 48px 16px;
	}

	.intro{
		margin : 0 0 16px;
	}

	.ways{
		display : grid;
		grid-template-columns : repeat(auto-fit, minmax(14rem, 1fr));
		gap : 16px;
	}

	section{
		display : flex;
		flex-direction : column;
		padding : 20px;
		border : 1px solid var(--line);
		border-radius : 18px;
		background : var(--surface-raised);
	}

	section p{
		flex : 1;
		margin : 0 0 14px;
		color : var(--text-muted);
		font-size : 0.95rem;
	}

	.layout{
		display : grid;
		grid-template-columns : auto 1fr;
		gap : 10px 20px;
		margin : 0 0 20px;
	}

	.layout dd{
		margin : 0;
		color : var(--text-muted);
	}

	.layout code{
		font-size : 0.88em;
		white-space : nowrap;
	}

	.steps{
		display : grid;
		gap : 20px;
		margin : 0;
		padding-left : 1.4rem;
	}

	.steps li{
		min-width : 0;
		overflow-wrap : anywhere;
	}

	.steps li::marker{
		color : var(--text-muted);
		font-family : var(--font-display);
	}

	.steps .code{
		margin-top : 10px;
		overflow-wrap : normal;
	}

	.steps :not(pre) > code, .steps a code{
		font-size : 0.88em;
	}

	.support{
		display : grid;
		grid-template-columns : repeat(auto-fit, minmax(16rem, 1fr));
		gap : 16px;
	}

	.card{
		display : flex;
		flex-direction : column;
		gap : 6px;
		padding : 22px 24px;
		border : 1px solid var(--line);
		border-radius : 18px;
		background : var(--surface-raised);
		color : inherit;
		text-decoration : none;
		transition : border-color 0.15s;
	}

	.card:hover{
		border-color : var(--bubble-1);
	}

	/* The sponsor card leads, in the colors of the header */
	.card.sponsor{
		border-color : var(--navy-line);
		background : var(--navy);
		color : var(--on-navy);
	}

	.card.sponsor .muted{
		color : var(--on-navy-muted);
	}

	.card.sponsor:hover{
		border-color : #ea4aaa;
	}

	.card .heart{
		color : var(--bubble-1);
		font-size : 1.5rem;
		line-height : 1;
	}

	.card.sponsor .heart{
		color : #ea4aaa;
	}

	.card strong{
		font : 500 1.3rem var(--font-display);
	}

	.muted{
		flex : 1;
		color : var(--text-muted);
		font-size : 0.95rem;
	}

	.cta{
		margin-top : 8px;
		font-size : 0.9rem;
		font-weight : 600;
	}

	.arrow{
		display : inline-block;
		transition : transform 0.15s;
	}

	.card:hover .arrow{
		transform : translateX(4px);
	}

	/* The repository layout stacks on a phone */
	@media (max-width: 560px){
		.layout{
			grid-template-columns : 1fr;
			gap : 2px;
		}

		.layout dd{
			margin-bottom : 10px;
		}
	}
</style>
