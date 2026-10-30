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
			<a class="npm" href="https://www.npmjs.com/package/@tyren/mousse">npm</a>
		</div>
	</nav>
</header>

{@render children()}

<footer>
	<div class="page">
		<span>MIT licensed. In French, <em>mousse</em> is soap foam : thousands of bubbles, the requests.</span>
		<span class="footer-links">
			<a href="https://github.com/Tyrenn/mousse">GitHub</a>
			<a href="https://www.npmjs.com/package/@tyren/mousse">npm</a>
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

	footer{
		padding-block : 28px;
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
	}

	/* Smallest phones : GitHub stays in the footer */
	@media (max-width: 400px){
		.github{
			display : none;
		}
	}
</style>
