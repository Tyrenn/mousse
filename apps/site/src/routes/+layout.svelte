<script lang="ts">
	import '@fontsource-variable/fredoka';
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import '../app.css';
	import { resolve } from '$app/paths';
	import Logo from '#lib/Logo.svelte';
	import { docHref } from '#lib/links.ts';

	let {children} = $props();
</script>

<header>
	<nav class="page" aria-label="Main">
		<a class="brand" href={resolve('/')} aria-label="Mousse, home">
			<Logo size={28} />
			<span>Mousse</span>
		</a>
		<div class="links">
			<a class="start" href={docHref('getting-started')}>Getting started</a>
			<a href={`${resolve('/docs')}/`}>Docs</a>
			<a href={`${resolve('/about')}/`}>About</a>
			<a class="github" href="https://github.com/Tyrenn/mousse">GitHub</a>
			<a class="npm" href="https://www.npmjs.com/package/@moussejs/core">npm</a>
		</div>
	</nav>
</header>

{@render children()}

<a class="sponsor" href="https://github.com/sponsors/Tyrenn" aria-label="Sponsor Mousse on GitHub">
	<span class="heart" aria-hidden="true">♥</span>
	<span class="sponsor-label">Sponsor</span>
</a>

<footer>
	<div class="page">
		<span>MIT licensed. In French, <em>mousse</em> is soap foam : thousands of bubbles, the requests.</span>
		<span class="footer-links">
			<a href="https://github.com/Tyrenn/mousse">GitHub</a>
			<a href="https://www.npmjs.com/package/@moussejs/core">npm</a>
			<a href="https://github.com/Tyrenn/mousse/issues">Report an issue</a>
		</span>
	</div>
</footer>

<style>
	header{
		position : sticky;
		top : 0;
		z-index : 10;
		background : var(--navy);
		border-bottom : 1px solid var(--navy-line);
	}

	nav{
		display : flex;
		align-items : center;
		justify-content : space-between;
		gap : 16px;
		height : 60px;
	}

	.brand{
		display : flex;
		align-items : center;
		gap : 8px;
		color : var(--on-navy);
		font : 500 1.3rem var(--font-display);
		text-decoration : none;
	}

	.links{
		display : flex;
		align-items : center;
		gap : clamp(14px, 3vw, 28px);
	}

	.links a{
		color : var(--on-navy-muted);
		font-size : 0.92rem;
		text-decoration : none;
	}

	.links a:hover{
		color : var(--on-navy);
	}

	/* The way in : same color as the main button of the home page */
	.links .start{
		padding : 4px 12px;
		border-radius : 999px;
		background : var(--bubble-1);
		color : var(--navy);
		font-weight : 600;
		white-space : nowrap;
	}

	.links .start:hover{
		background : var(--bubble-3);
		color : var(--navy);
	}

	/* Always one click away, above the content */
	.sponsor{
		position : fixed;
		right : 16px;
		bottom : 16px;
		z-index : 20;
		display : flex;
		align-items : center;
		gap : 6px;
		padding : 8px 14px;
		border : 1px solid var(--navy-line);
		border-radius : 999px;
		background : var(--navy);
		box-shadow : 0 4px 16px rgb(0 33 55 / 0.25);
		color : var(--on-navy);
		font-size : 0.88rem;
		font-weight : 600;
		text-decoration : none;
		transition : transform 0.15s;
	}

	.sponsor:hover{
		transform : translateY(-2px);
	}

	.heart{
		color : #ea4aaa;
		font-size : 1.05rem;
		line-height : 1;
	}

	/* The bottom padding keeps the footer links clear of the sponsor badge */
	footer{
		padding-block : 28px 76px;
		border-top : 1px solid var(--line);
		color : var(--text-muted);
		font-size : 0.875rem;
	}

	footer .page{
		display : flex;
		flex-wrap : wrap;
		justify-content : space-between;
		gap : 8px 24px;
	}

	.footer-links{
		display : flex;
		gap : 16px;
	}

	/* The whole menu on a phone : npm stays in the footer, the logo alone leads home */
	@media (max-width: 560px){
		.brand span, .npm{
			display : none;
		}

		.links{
			gap : 12px;
		}

		.links .start{
			padding-inline : 10px;
		}

		/* The heart alone, to cover as little text as possible */
		.sponsor{
			padding : 10px;
		}

		.sponsor-label{
			display : none;
		}
	}

	/* Smallest phones : GitHub stays in the footer */
	@media (max-width: 400px){
		.github{
			display : none;
		}
	}
</style>
