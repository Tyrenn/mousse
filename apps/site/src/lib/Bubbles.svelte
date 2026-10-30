<script lang="ts">
	// Fixed positions : the prerendered page and the hydrated one must match
	const bubbles = [
		{left : 4, size : 46, delay : 0, duration : 19, color : '#0e9fff'},
		{left : 13, size : 18, delay : 7, duration : 14, color : '#b6e2ff'},
		{left : 24, size : 30, delay : 3, duration : 22, color : '#80ccff'},
		{left : 37, size : 14, delay : 11, duration : 16, color : '#b6e2ff'},
		{left : 49, size : 24, delay : 5, duration : 20, color : '#0e9fff'},
		{left : 60, size : 54, delay : 9, duration : 25, color : '#005a95'},
		{left : 71, size : 20, delay : 2, duration : 17, color : '#80ccff'},
		{left : 82, size : 38, delay : 13, duration : 21, color : '#0e9fff'},
		{left : 93, size : 16, delay : 6, duration : 15, color : '#b6e2ff'}
	];

	let popped = $state<number[]>([]);

	const pop = (index : number) => popped.push(index);
	const reset = (index : number) => popped = popped.filter((other) => other !== index);
</script>

<!-- Let us play with bubbles : decorative, hidden from assistive technologies and from the keyboard -->
<div class="bubbles" aria-hidden="true">
	{#each bubbles as bubble, index (bubble.left)}
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button
			type="button"
			tabindex="-1"
			class={['bubble', popped.includes(index) && 'popped']}
			style:left="{bubble.left}%"
			style:--size="{bubble.size}px"
			style:--color={bubble.color}
			style:animation-delay="-{bubble.delay}s"
			style:animation-duration="{bubble.duration}s"
			onclick={() => pop(index)}
			onanimationiteration={() => reset(index)}
		></button>
	{/each}
</div>

<style>
	.bubbles{
		position : absolute;
		inset : 0;
		overflow : hidden;
		pointer-events : none;
	}

	.bubble{
		position : absolute;
		bottom : calc(-1 * var(--size));
		width : var(--size);
		height : var(--size);
		padding : 0;
		border : 0;
		border-radius : 50%;
		background : radial-gradient(circle at 32% 28%, #fff 0 9%, transparent 10%), var(--color);
		opacity : 0.4;
		cursor : pointer;
		pointer-events : auto;
		animation : rise linear infinite;
		transition : transform 0.18s ease-out, opacity 0.18s ease-out;
	}

	/* Popped : gone until its next way up */
	.popped{
		transform : scale(1.8);
		opacity : 0 !important;
		pointer-events : none;
	}

	@keyframes rise{
		from{
			translate : 0 0;
		}
		50%{
			translate : 18px -55vh;
		}
		to{
			translate : -6px -110vh;
		}
	}

	@media (prefers-reduced-motion: reduce){
		.bubble{
			display : none;
		}
	}
</style>
