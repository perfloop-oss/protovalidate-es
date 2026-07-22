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

import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suite, test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { compileMessage } from "@bufbuild/protocompile";
import { createValidator } from "./validator.js";

const compileOptions = {
  imports: {
    "buf/validate/validate.proto": readFileSync(
      "proto/buf/validate/validate.proto",
      "utf-8",
    ),
  },
};

void suite("Planner", () => {
  void test("keeps scalar collection rules without item rules", () => {
    const schema = compileMessage(
      `
        syntax = "proto3";
        import "buf/validate/validate.proto";
        message ListRules {
          repeated int32 values = 1 [
            (buf.validate.field).repeated.max_items = 2
          ];
        }
      `,
      compileOptions,
    );
    const validator = createValidator();

    const valid = validator.validate(
      schema,
      create(schema, { values: [1, 2] }),
    );
    assert.equal(valid.kind, "valid");

    const invalid = validator.validate(
      schema,
      create(schema, { values: [1, 2, 3] }),
    );
    assert.equal(invalid.kind, "invalid");
    assert.deepEqual(
      invalid.violations?.map((violation) => violation.ruleId),
      ["repeated.max_items"],
    );
  });
});
