//@ts-ignore
import { assertEquals } from "https://deno.land/std@0.80.0/testing/asserts.ts";
//@ts-ignore
import { bench, runBenchmarks, BenchmarkRunResult } from "https://deno.land/std@0.80.0/testing/bench.ts";
//@ts-ignore
import { Mousse } from "../mod.ts";

const mousse = new Mousse({port : 8080});

mousse.any("/", async (c) => c.string(c.request.url).respond());

mousse.start();

bench({
  name: "simple mousse app",
  runs: 5000000,
  async func(b : any): Promise<void> {
    b.start();
    const conns = [];
    for (let i = 0; i < 50; ++i) {
      conns.push(fetch("http://localhost:8080/").then((res) => {
        return res.text();
      }));
    }
    await Promise.all(conns);
    for await (const i of conns) {
      assertEquals(i, "/");
    }
    b.stop();
  },
});

runBenchmarks().then((results: BenchmarkRunResult) => {
    console.log(results);
  }).finally(() => {
  mousse.close();
});