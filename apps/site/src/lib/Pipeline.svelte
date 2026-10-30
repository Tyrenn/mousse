<script lang="ts">
	// The order documented in docs/routing.md#request-hooks
	const steps = [
		{name : 'Request hooks', detail : 'Block an address, tag a request', exit : 'any status'},
		{name : 'Rate limiter', detail : 'Counted before anything is parsed', exit : '429'},
		{name : 'Body limit', detail : 'Declared size, then received bytes', exit : '413'},
		{name : 'Params & Query', detail : 'Validated and typed', exit : '400'},
		{name : 'Middlewares', detail : 'Authentication, context extensions', exit : 'any status'},
		{name : 'Body', detail : 'Validated, only once middlewares passed', exit : '400'},
		{name : 'Handler', detail : 'Gets clean, typed data', exit : null}
	];
</script>

<ol style:--steps={steps.length}>
	{#each steps as step, index (step.name)}
		<li>
			<!-- The request is a bubble : it shows up at each stage, then pops -->
			<span class="dot" style:--step={index} aria-hidden="true"></span>
			<div class="text">
				<strong>{step.name}</strong>
				<span class="detail">{step.detail}</span>
			</div>
			{#if step.exit}
				<span class="exit">can stop here : {step.exit}</span>
			{/if}
		</li>
	{/each}
</ol>

<style>
	ol{
		--dot : 16px;
		--stage : 1.1s;
		position : relative;
		margin : 0;
		padding : 0;
		list-style : none;
	}

	ol::before{
		content : '';
		position : absolute;
		top : 14px;
		bottom : 14px;
		left : calc(var(--dot) / 2 - 1px);
		width : 2px;
		background : var(--navy-line);
	}

	li{
		position : relative;
		display : grid;
		grid-template-columns : var(--dot) minmax(0, 1fr) auto;
		align-items : baseline;
		column-gap : 18px;
		padding-block : 11px;
	}

	.dot{
		position : relative;
		align-self : center;
		width : var(--dot);
		height : var(--dot);
		border : 2px solid var(--bubble-3);
		border-radius : 50%;
		background : var(--navy);
	}

	/* One cycle lasts a stage per step, each dot takes its turn : only one bubble exists at a time */
	.dot::before, .dot::after{
		content : '';
		position : absolute;
		border-radius : 50%;
		opacity : 0;
		animation-duration : calc(var(--steps) * var(--stage));
		animation-delay : calc(var(--step) * var(--stage));
		animation-iteration-count : infinite;
	}

	.dot::before{
		inset : -6px;
		background : radial-gradient(circle at 32% 28%, #fff 0 12%, transparent 13%), var(--bubble-1);
		animation-name : bubble;
		animation-timing-function : ease-out;
	}

	.dot::after{
		inset : -6px;
		border : 2px solid var(--bubble-2);
		animation-name : burst;
		animation-timing-function : ease-out;
	}

	/* Percentages of the whole cycle : 14% is about one stage out of seven */
	@keyframes bubble{
		0%{
			opacity : 0;
			transform : scale(0.2);
		}
		3%{
			opacity : 1;
			transform : scale(1);
		}
		10%{
			opacity : 1;
			transform : scale(1);
		}
		11%, 100%{
			opacity : 0;
			transform : scale(1.2);
		}
	}

	@keyframes burst{
		0%, 10%{
			opacity : 0;
			transform : scale(1);
		}
		11%{
			opacity : 1;
			transform : scale(1.1);
		}
		14%, 100%{
			opacity : 0;
			transform : scale(1.9);
		}
	}

	strong{
		display : block;
		color : var(--on-navy);
		font : 500 1.08rem/1.3 var(--font-display);
	}

	.detail{
		color : var(--on-navy-muted);
		font-size : 0.9rem;
	}

	.exit{
		color : var(--on-navy-muted);
		font : 0.78rem var(--font-mono);
		white-space : nowrap;
	}

	@media (max-width: 560px){
		li{
			grid-template-columns : var(--dot) minmax(0, 1fr);
		}

		.dot{
			align-self : start;
			margin-top : 4px;
		}

		.exit{
			grid-column : 2;
			white-space : normal;
		}
	}
</style>
