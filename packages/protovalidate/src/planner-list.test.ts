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

void suite("repeated field planning", () => {
  void test("keeps collection-level and item-level rules distinct", () => {
    const schema = compileMessage(
      `
        syntax = "proto3";
        import "buf/validate/validate.proto";
        message ListRules {
          repeated int32 count_only = 1 [
            (buf.validate.field).repeated.max_items = 2
          ];
          repeated string item_rules = 2 [
            (buf.validate.field).repeated.items.string.min_len = 3
          ];
        }
      `,
      compileOptions,
    );
    const result = createValidator().validate(
      schema,
      create(schema, {
        countOnly: [1, 2, 3],
        itemRules: ["ok"],
      }),
    );

    assert.equal(result.kind, "invalid");
    assert.deepEqual(
      result.violations?.map((violation) => violation.ruleId),
      ["repeated.max_items", "string.min_len"],
    );
  });

  void test("continues to validate collection rules through recursive messages", () => {
    const schema = compileMessage(
      `
        syntax = "proto3";
        import "buf/validate/validate.proto";
        message Node {
          repeated Node children = 1;
          repeated int32 values = 2 [
            (buf.validate.field).repeated.max_items = 2
          ];
        }
      `,
      compileOptions,
    );
    const result = createValidator().validate(
      schema,
      create(schema, {
        children: [{ values: [1, 2, 3] }],
      }),
    );

    assert.equal(result.kind, "invalid");
    assert.equal(result.violations?.length, 1);
    assert.equal(result.violations?.[0]?.ruleId, "repeated.max_items");
    assert.match(
      result.violations?.[0]?.toString() ?? "",
      /^children\[0\]\.values:/,
    );
  });
});
