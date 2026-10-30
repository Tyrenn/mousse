<script lang="ts">
	import type { Benchmark } from '#lib/server/content.ts';

	let {rows} : {rows : Benchmark[]} = $props();

	let highest = $derived(Math.max(...rows.map((row) => row.requests)));
</script>

<!-- Every value is written out : the table is its own accessible view, no tooltip hides anything -->
<table>
	<caption>Requests per second on a plain-text route, higher is better</caption>
	<thead>
		<tr>
			<th scope="col">Framework</th>
			<th scope="col" class="bar-cell"><span class="visually-hidden">Compared</span></th>
			<th scope="col" class="number">req/s</th>
			<th scope="col" class="number">avg</th>
			<th scope="col" class="number">p99</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.name)}
			<tr class={{highlighted : row.highlighted}}>
				<th scope="row">{row.name}</th>
				<td class="bar-cell">
					<span class="bar" style:width="{row.requests / highest * 100}%"></span>
				</td>
				<td class="number">{row.requestsLabel}</td>
				<td class="number">{row.average}</td>
				<td class="number">{row.p99}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table{
		display : block;
		width : 100%;
		font-size : 0.9rem;
		font-variant-numeric : tabular-nums;
	}

	caption{
		display : block;
		margin-bottom : 16px;
		color : var(--text-muted);
		text-align : left;
	}

	thead, tbody{
		display : block;
	}

	tr{
		display : grid;
		grid-template-columns : 11.5rem minmax(0, 1fr) 4.5rem 4.75rem 3.5rem;
		align-items : center;
		column-gap : 14px;
		padding-block : 7px;
		border-radius : 8px;
	}

	tbody tr:hover{
		background : var(--surface-raised);
	}

	thead th{
		color : var(--text-muted);
		font-size : 0.8rem;
		font-weight : 500;
		text-align : left;
	}

	tbody th{
		font-weight : 400;
		text-align : left;
	}

	.number{
		text-align : right;
		white-space : nowrap;
	}

	thead .number{
		text-align : right;
	}

	.bar{
		display : block;
		height : 14px;
		border-radius : 0 4px 4px 0;
		background : var(--bar-muted);
	}

	.highlighted th, .highlighted td{
		font-weight : 600;
	}

	.highlighted .bar{
		background : var(--accent);
	}

	.visually-hidden{
		position : absolute;
		width : 1px;
		height : 1px;
		overflow : hidden;
		clip-path : inset(50%);
	}

	@media (max-width: 720px){
		/* The bar takes its own line : numbers stay readable on a phone */
		tr{
			grid-template-columns : minmax(0, 1fr) auto auto auto;
			row-gap : 4px;
		}

		.bar-cell{
			grid-row : 2;
			grid-column : 1 / -1;
		}

		thead .bar-cell{
			display : none;
		}
	}
</style>
