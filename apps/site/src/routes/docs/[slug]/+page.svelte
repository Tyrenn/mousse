<script lang="ts">
	import { docHref } from '#lib/links.ts';
	import { copyCode } from '#lib/copy.ts';

	let {data} = $props();

	let index = $derived(data.docs.findIndex((doc) => data.doc.title === doc.title));
	let previous = $derived(data.docs[index - 1]);
	let next = $derived(data.docs[index + 1]);

	// Code blocks come out of the markdown : one listener for all of them
	const copyButtons = (article : HTMLElement) => {
		const onclick = (event : MouseEvent) => {
			const button = (event.target as HTMLElement).closest<HTMLElement>('.copy');
			if(button)
				copyCode(button);
		};

		article.addEventListener('click', onclick);
		return () => article.removeEventListener('click', onclick);
	};
</script>

<svelte:head>
	<title>{data.doc.title} : Mousse</title>
</svelte:head>

<div class="columns">
	<article {@attach copyButtons}>
		<h1>{data.doc.title}</h1>
		<!-- Rendered at build time from docs/*.md of this repository -->
		<div class="prose">{@html data.doc.html}</div>

		<nav class="pager" aria-label="Previous and next page">
			{#if previous}
				<a href={docHref(previous.slug)}>« {previous.title}</a>
			{:else}
				<span></span>
			{/if}
			{#if next}
				<a href={docHref(next.slug)}>{next.title} »</a>
			{/if}
		</nav>
	</article>

	{#if data.doc.toc.length > 1}
		<nav class="toc" aria-label="On this page">
			<p>On this page</p>
			<ul>
				{#each data.doc.toc as entry (entry.id)}
					<li><a href="#{entry.id}">{entry.text}</a></li>
				{/each}
			</ul>
		</nav>
	{/if}
</div>

<style>
	.columns{
		display : grid;
		grid-template-columns : minmax(0, 1fr) 13rem;
		gap : 40px;
		align-items : start;
	}

	h1{
		margin-bottom : 20px;
		font-size : clamp(2rem, 4vw, 2.5rem);
	}

	.toc{
		position : sticky;
		top : 92px;
		font-size : 0.85rem;
	}

	.toc p{
		margin : 0 0 8px;
		color : var(--text);
		font-weight : 600;
	}

	.toc ul{
		margin : 0;
		padding : 0;
		list-style : none;
	}

	.toc a{
		display : block;
		padding-block : 3px;
		color : var(--text-muted);
		line-height : 1.35;
		text-decoration : none;
	}

	.toc a:hover{
		color : var(--text);
	}

	.pager{
		display : flex;
		justify-content : space-between;
		gap : 16px;
		margin-top : 56px;
		padding-top : 20px;
		border-top : 1px solid var(--line);
	}

	.prose{
		overflow-wrap : anywhere;
	}

	.prose :global {
		h2, h3, h4{
			scroll-margin-top : 80px;
		}

		h2{
			margin-block : 44px 14px;
			font-size : 1.6rem;
		}

		h3{
			margin-block : 32px 10px;
			font-size : 1.2rem;
		}

		h4{
			margin-block : 24px 8px;
			font-size : 1.05rem;
		}

		:is(h2, h3, h4) a{
			color : inherit;
			text-decoration : none;
		}

		:is(h2, h3, h4) a:hover::after{
			content : ' #';
			color : var(--text-muted);
		}

		p, ul, ol{
			margin-block : 0 14px;
		}

		li{
			margin-block : 4px;
		}

		ul, ol{
			padding-left : 1.4rem;
		}

		:not(pre) > code{
			padding : 2px 5px;
			border-radius : 5px;
			background : var(--inline-code);
			font-size : 0.86em;
		}

		.code{
			margin-block : 16px 20px;
			overflow-wrap : normal;
		}

		blockquote{
			margin : 16px 0;
			padding : 10px 16px;
			border-left : 3px solid var(--accent);
			border-radius : 0 8px 8px 0;
			background : var(--surface-raised);
		}

		blockquote p:last-child{
			margin-bottom : 0;
		}

		hr{
			margin-block : 32px;
			border : 0;
			border-top : 1px solid var(--line);
		}

		.table-wrap{
			margin-block : 16px 20px;
			overflow-x : auto;
		}

		table{
			width : 100%;
			border-collapse : collapse;
			font-size : 0.92rem;
			overflow-wrap : normal;
		}

		th, td{
			padding : 8px 12px;
			border-bottom : 1px solid var(--line);
			text-align : left;
			vertical-align : top;
		}

		th{
			font-weight : 600;
		}
	}

	@media (max-width: 1100px){
		.columns{
			grid-template-columns : minmax(0, 1fr);
		}

		.toc{
			display : none;
		}
	}
</style>
