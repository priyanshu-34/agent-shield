# Third-party data

`deepset-test.json` is the test split of [deepset/prompt-injections](https://huggingface.co/datasets/deepset/prompt-injections),
by deepset GmbH, licensed under the Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
Converted from Parquet to JSON (fields renamed to `text` and `attack`); no other changes.

`llmail-sample.json` is a sample of [microsoft/llmail-inject-challenge](https://huggingface.co/datasets/microsoft/llmail-inject-challenge)
(`labelled_unique_submissions_phase2.json` and `emails_for_fp_tests.json`), rebuilt with `bench/fetch-llmail.ts` (seed 42).
Licensed under the MIT License:

> (The dataset card declares `license: mit` and names no copyright holder; the dataset is published by Microsoft.)
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation
> the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
> permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of
> the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
> THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
> TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
