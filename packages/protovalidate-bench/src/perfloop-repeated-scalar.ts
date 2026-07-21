// Copyright 2024-2026 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { create } from "@bufbuild/protobuf";
import { createValidator } from "@bufbuild/protovalidate";
import { Bench } from "tinybench";
import { Cursor } from "../../protovalidate/dist/esm/cursor.js";
import { BenchRepeatedScalarSchema } from "./gen/bench/v1/bench_pb.js";

const inputs = [
  create(BenchRepeatedScalarSchema, { x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }),
  create(BenchRepeatedScalarSchema, { x: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] }),
  create(BenchRepeatedScalarSchema, { x: [3, 4, 5, 6, 7, 8, 9, 10, 1, 2] }),
  create(BenchRepeatedScalarSchema, { x: [4, 5, 6, 7, 8, 9, 10, 1, 2, 3] }),
] as const;
const validator = createValidator();

function validate(input: (typeof inputs)[number]): number {
  const result = validator.validate(BenchRepeatedScalarSchema, input);
  if (result.kind !== "valid") {
    throw new Error(`unexpected validation result: ${result.kind}`);
  }
  return result.message.x[0] ?? 0;
}

let checksum = 0;
for (const input of inputs) {
  checksum += validate(input);
}

const originalList = Cursor.prototype.list;
let listCalls = 0;
Cursor.prototype.list = function (index: number): Cursor {
  listCalls++;
  return originalList.call(this, index);
};
try {
  for (const input of inputs) {
    checksum += validate(input);
  }
} finally {
  Cursor.prototype.list = originalList;
}
if (listCalls % inputs.length !== 0) {
  throw new Error(
    `expected a whole number of list calls per validation: ${listCalls}`,
  );
}

let inputIndex = 0;
const bench = new Bench({
  time: 200,
  warmupTime: 100,
});
bench.add("repeated-scalar-max-items", () => {
  checksum += validate(inputs[inputIndex] ?? inputs[0]);
  inputIndex = (inputIndex + 1) % inputs.length;
});
await bench.run();
if (checksum === 0) {
  throw new Error("validation results were not consumed");
}

const result = bench.tasks[0]?.result;
if (result?.state !== "completed") {
  throw new Error(
    `benchmark did not complete: ${result?.state ?? "missing task"}`,
  );
}
console.log(
  JSON.stringify({ metric: "ns/op", value: result.latency.mean * 1_000_000 }),
);
console.log(
  JSON.stringify({
    metric: "cursor.list calls/op",
    value: listCalls / inputs.length,
  }),
);
