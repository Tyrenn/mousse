<script lang="ts">
	import { docHref } from '#lib/links.ts';
	import { page } from '$app/state';

	let {data, children} = $props();
</script>

<div class="page layout">
	<nav aria-label="Documentation">
		<ul>
			{#each data.docs as doc (doc.slug)}
				{@const href = docHref(doc.slug)}
				<li>
					<a {href} aria-current={page.params.slug === doc.slug ? 'page' : undefined}>{doc.title}</a>
				</li>
			{/each}
		</ul>
	</nav>
	<main>
		{@render children()}
	</main>
</div>

<style>
	.layout{
		display : grid;
		grid-template-columns : 13rem minmax(0, 1fr);
		gap : clamp(24px, 4vw, 56px);
		align-items : start;
	}

	nav{
		position : sticky;
		top : 60px;
		padding-block : 32px;
	}

	ul{
		margin : 0;
		padding : 0;
		list-style : none;
	}

	a{
		display : block;
		padding : 5px 12px;
		border-radius : 8px;
		color : var(--text-muted);
		font-size : 0.93rem;
		text-decoration : none;
		white-space : nowrap;
	}

	a:hover{
		color : var(--text);
	}

	a[aria-current='page']{
		background : var(--surface-raised);
		color : var(--text);
		font-weight : 600;
	}

	main{
		min-width : 0;
		padding-block : 32px 72px;
	}

	@media (max-width: 860px){
		.layout{
			grid-template-columns : minmax(0, 1fr);
			gap : 0;
		}

		/* A strip under the header, scrolling on its own */
		nav{
			z-index : 5;
			margin-inline : calc(-1 * var(--gutter));
			padding : 8px var(--gutter);
			background : var(--surface);
			border-bottom : 1px solid var(--line);
			overflow-x : auto;
			scrollbar-width : none;
		}

		ul{
			display : flex;
			gap : 4px;
		}
	}
</style>
