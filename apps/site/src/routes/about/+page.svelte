<script lang="ts">
	let {data} = $props();

	const GITHUB = 'https://github.com/Tyrenn';
</script>

<svelte:head>
	<title>About : Mousse</title>
	<meta name="description" content="Mousse is a personal project by Guillaume Vailland, maintained on a volunteer basis. How to contribute, and Hélice, a typesafe PostgreSQL query builder." />
</svelte:head>

<main class="page">
	<h1>About</h1>
	<p class="lead">
		Hello there ! I'm <a href="https://www.linkedin.com/in/guillaume-vailland-136408125/">Guillaume Vailland</a> (Tyren), a humble typescript developer from Nantes, France.
	</p>
	<p class="lead">
		I started Mousse as a personal project, to learn how frameworks like these work under the hood. It draws heavily on its peers, such as
		Express, Fastify and Koa. I'm very happy to have reached a version mature enough to be published and used in production, and I intend to
		keep maintaining and improving it on a volunteer basis.
	</p>

	<h2 class="more">My other work</h2>
	<section>
		<div class="title">
			<span class="propeller" aria-hidden="true">🛩</span>
			<h3>Hélice</h3>
		</div>
		<p>
			A fluent, typesafe PostgreSQL query builder for TypeScript. You give it your database schema as plain types, with no schema
			file, no codegen and no decorators, and it has no runtime dependency.
		</p>
		<div class="code">
			<pre>{@html data.helice}</pre>
		</div>
		<p class="aside">
			“Hélice”, pronounced <em>ay-lees</em>, is French for propeller, which looks a bit like a <em>q</em> and a <em>b</em> of
			query builder stacked on top of each other.
		</p>
		<a href="{GITHUB}/helice">Tyrenn/helice</a>
	</section>

	<h2 class="more" id="contributing">Contributing</h2>
	<p class="intro">
		The simplest contribution is to test Mousse and <a href="{GITHUB}/mousse/issues">open issues</a> to help chase the bugs. For code contributions:
	</p>
	<ol class="steps">
		<li>
			<strong>Fork</strong> <a href="{GITHUB}/mousse">the repository</a> and create a branch from <code>main</code>.
			<div class="code"><pre>{@html data.contributing.setup}</pre></div>
		</li>
		<li>
			<strong>Make your change</strong>, with tests : an integration test in
			<a href="{GITHUB}/mousse/tree/main/apps/examples/tests"><code>apps/examples/tests</code></a> for a new feature, a unit test in
			<a href="{GITHUB}/mousse/tree/main/packages/mousse/tests"><code>packages/mousse/tests</code></a> for pure logic. Then check everything locally.
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

	section{
		padding : 24px;
		border : 1px solid var(--line);
		border-radius : 18px;
		background : var(--surface-raised);
	}

	.title{
		display : flex;
		align-items : center;
		gap : 12px;
		margin-bottom : 14px;
		min-height : 40px;
	}

	.propeller{
		font-size : 1.9rem;
		line-height : 1;
	}

	h2{
		font-size : 1.6rem;
	}

	h3{
		font-size : 1.4rem;
	}

	section p{
		margin : 0 0 14px;
	}

	section .code{
		margin-bottom : 14px;
	}

	.aside{
		color : var(--text-muted);
		font-size : 0.9rem;
	}

	.more{
		margin-block : 48px 16px;
	}

	.intro{
		margin : 0 0 20px;
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
</style>
