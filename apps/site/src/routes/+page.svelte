<script lang="ts">
	import { docHref } from '#lib/links.ts';
	import BenchmarkChart from '#lib/BenchmarkChart.svelte';
	import Bubbles from '#lib/Bubbles.svelte';
	import Logo from '#lib/Logo.svelte';
	import Pipeline from '#lib/Pipeline.svelte';
	import { copyCode } from '#lib/copy.ts';

	let {data} = $props();

	let selected = $state('http');
	let snippet = $derived(data.snippets.find((other) => other.id === selected) ?? data.snippets[0]);

	const features = [
		{title : 'Fully typed', text : 'Request body, response, route params and context extensions, inferred from your schemas.'},
		{title : 'Swappable modules', text : 'Body parser, serializer, logger, error handlers and rate limiter, per route or per router.'},
		{title : 'Documentation from your routes', text : 'A self-styled HTML site or standard OpenAPI 3.1, generated from the same schemas.'},
		{title : 'One-call route testing', text : 'router.test() fires real requests through a single ephemeral instance, no port to manage.'},
		{title : 'Ready for production', text : 'Body limits, trusted proxies, graceful stop, response hooks for your logs and metrics.'},
		{title : 'Backpressure handled', text : 'WebSocket and SSE sends queue when a client is slow, instead of piling up in memory.'}
	];
</script>

<svelte:head>
	<title>Mousse : a typed Node.js web framework on µWebSockets.js</title>
	<meta name="description" content="HTTP routing, WebSockets and Server-Sent Events through a single Context API, with Standard Schema validation, rate limiting and documentation generation." />
</svelte:head>

<section class="hero">
	<Bubbles />
	<div class="page hero-grid">
		<div class="pitch">
			<div class="lockup">
				<Logo size={84} />
				<div>
					<p class="wordmark">Mousse</p>
					<p class="motto">Let us play with bubbles</p>
				</div>
			</div>
			<h1>All of the soap, none of the opera.</h1>
			<p class="lead">
				A typed Node.js framework built on top of µWebSockets, for HTTP, WebSockets and Server-Sent Events.
			</p>
			<div class="actions">
				<a class="button primary" href={docHref('getting-started')}>Get started</a>
				<div class="code install">
					<pre><code>pnpm add @tyren/mousse</code></pre>
					<button type="button" class="copy" onclick={(event) => copyCode(event.currentTarget)}>Copy</button>
				</div>
			</div>
		</div>
		<div class="code hero-code">
			<pre>{@html data.quickstart}</pre>
		</div>
	</div>
</section>

<section class="page section">
	<h2>One way to write all of it</h2>
	<div class="tabs" role="tablist" aria-label="Examples">
		{#each data.snippets as other (other.id)}
			<button
				type="button"
				role="tab"
				id="tab-{other.id}"
				aria-selected={selected === other.id}
				aria-controls="example"
				class={{active : selected === other.id}}
				onclick={() => selected = other.id}
			>{other.label}</button>
		{/each}
	</div>
	<div id="example" role="tabpanel" aria-labelledby="tab-{snippet.id}">
		<p class="summary">
			{snippet.summary}
			<a href={docHref(snippet.doc)}>Read more</a>
		</p>
		<div class="code">
			<pre>{@html snippet.html}</pre>
		</div>
	</div>
</section>

<section class="journey">
	<div class="page journey-grid">
		<div>
			<h2>A request has a clear path</h2>
			<p>
				Each stage can end the request, and nothing after it runs. What is cheap to refuse is refused first : a client over
				its limit never costs you a schema validation, and your authentication runs before a body gets parsed.
			</p>
			<a href={docHref('routing', '#request-hooks')}>How requests are handled</a>
		</div>
		<Pipeline />
	</div>
</section>

<section class="page section" id="benchmarks">
	<h2>As fast as what it is built on</h2>
	<p class="intro">
		Mousse runs within measurement noise of raw µWebSockets.js, while adding routing, middlewares, validation and the whole
		<code>Context</code> API.
	</p>
	<BenchmarkChart rows={data.benchmarks} />
	<p class="note">
		100 connections for 10 seconds with <a href="https://github.com/mcollina/autocannon">autocannon</a>, Node 24, same machine
		for all. Single runs : numbers vary with hardware, and differences under about 5% are not significant.
		Run <code>pnpm bench</code> to reproduce on yours.
	</p>
</section>

<section class="page section">
	<h2>And the rest</h2>
	<ul class="features">
		{#each features as feature (feature.title)}
			<li>
				<h3>{feature.title}</h3>
				<p>{feature.text}</p>
			</li>
		{/each}
	</ul>
</section>

<section class="page section">
	<h2>Before you install</h2>
	<p class="intro">
		µWebSockets.js ships prebuilt binaries only. Mousse runs on <strong>Node.js 22, 24 and 26</strong>, on glibc Linux (x64, arm64),
		macOS and Windows. Alpine (musl) and odd Node versions fail at import : use an image such as <code>node:24-slim</code>.
		µWebSockets.js is installed from GitHub rather than npm, so strict package managers may need to allow it.
	</p>
	<div class="doc-links">
		{#each data.docs as doc (doc.slug)}
			<a href={docHref(doc.slug)}>
				<strong>{doc.title}</strong>
				<span>{doc.description}</span>
			</a>
		{/each}
	</div>
</section>

<style>
	.hero{
		position : relative;
		padding-block : clamp(48px, 8vw, 96px);
		background : var(--navy);
		color : var(--on-navy);
		overflow : hidden;
	}

	.hero-grid{
		position : relative;
		display : grid;
		grid-template-columns : minmax(0, 1fr) minmax(0, 1fr);
		align-items : center;
		gap : clamp(32px, 5vw, 64px);
		pointer-events : none;
	}

	.hero-grid > *{
		pointer-events : auto;
	}

	.lockup{
		display : flex;
		align-items : center;
		gap : 14px;
		margin-bottom : 28px;
	}

	.wordmark{
		margin : 0;
		font : 500 2.6rem/1 var(--font-display);
	}

	.motto{
		margin : 6px 0 0;
		color : var(--bubble-3);
		font : 500 1.05rem/1.2 var(--font-display);
	}

	h1{
		font-size : clamp(2.2rem, 5vw, 3.5rem);
		line-height : 1.08;
	}

	.lead{
		max-width : 34rem;
		margin : 20px 0 28px;
		color : var(--on-navy-muted);
		font-size : 1.1rem;
	}

	.actions{
		display : flex;
		flex-wrap : wrap;
		align-items : center;
		gap : 12px;
	}

	.button{
		padding : 11px 22px;
		border-radius : 999px;
		font : 500 1rem var(--font-display);
		text-decoration : none;
	}

	.primary{
		background : var(--bubble-1);
		color : var(--navy);
	}

	.primary:hover{
		background : var(--bubble-3);
	}

	.install{
		background : var(--navy-raised);
		border-radius : 999px;
	}

	.install pre{
		padding : 9px 66px 9px 18px;
	}

	.install .copy{
		top : 7px;
		opacity : 1;
	}

	.hero-code{
		background : var(--navy-raised);
	}

	.section{
		padding-block : clamp(56px, 8vw, 88px);
	}

	h2{
		margin-bottom : 16px;
		font-size : clamp(1.6rem, 3.2vw, 2.25rem);
	}

	.intro{
		max-width : 46rem;
		margin : 0 0 28px;
		color : var(--text-muted);
	}

	code{
		font-size : 0.92em;
	}

	.tabs{
		display : flex;
		gap : 6px;
		margin-block : 24px 16px;
		overflow-x : auto;
		scrollbar-width : none;
	}

	.tabs button{
		flex : none;
		padding : 7px 16px;
		border : 1px solid var(--line);
		border-radius : 999px;
		background : none;
		color : var(--text-muted);
		font : 500 0.92rem var(--font-body);
		cursor : pointer;
	}

	.tabs button:hover{
		color : var(--text);
	}

	.tabs .active, .tabs .active:hover{
		border-color : var(--accent);
		background : var(--accent);
		color : var(--on-accent);
	}

	.summary{
		min-height : 2lh;
		margin : 0 0 12px;
		color : var(--text-muted);
	}

	.journey{
		padding-block : clamp(56px, 8vw, 88px);
		background : var(--navy);
		color : var(--on-navy);
	}

	.journey-grid{
		display : grid;
		grid-template-columns : minmax(0, 5fr) minmax(0, 6fr);
		gap : clamp(32px, 5vw, 72px);
	}

	.journey p{
		color : var(--on-navy-muted);
	}

	.journey a{
		color : var(--bubble-3);
	}

	.note{
		max-width : 46rem;
		margin : 20px 0 0;
		color : var(--text-muted);
		font-size : 0.875rem;
	}

	.features{
		display : grid;
		grid-template-columns : repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
		gap : 28px 40px;
		margin : 28px 0 0;
		padding : 0;
		list-style : none;
	}

	.features h3{
		margin-bottom : 6px;
		font-size : 1.15rem;
	}

	.features p{
		margin : 0;
		color : var(--text-muted);
	}

	.doc-links{
		display : grid;
		grid-template-columns : repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
		gap : 12px;
	}

	.doc-links a{
		padding : 14px 16px;
		border : 1px solid var(--line);
		border-radius : 14px;
		color : inherit;
		text-decoration : none;
	}

	.doc-links a:hover{
		border-color : var(--accent);
	}

	.doc-links strong{
		display : block;
		font : 500 1.05rem var(--font-display);
	}

	.doc-links span{
		color : var(--text-muted);
		font-size : 0.875rem;
	}

	@media (max-width: 860px){
		.hero-grid, .journey-grid{
			grid-template-columns : minmax(0, 1fr);
		}
	}
</style>
