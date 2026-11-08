<script setup lang="ts">
const REPO = 'https://github.com/omeoproject/clean-sheet'

const before = [
  { n: 2, name: 'Ann Lee', email: 'ann@acme.com', city: 'New York', dup: false },
  { n: 3, name: 'Bob Ray', email: 'bob@acme.com', city: 'Austin', dup: false },
  { n: 4, name: 'Ann Lee', email: 'ANN@acme.com ', city: 'New York', dup: true },
  { n: 5, name: 'Cy Dunn', email: 'cy@acme.com', city: 'Boston', dup: false },
  { n: 6, name: 'Bob Ray', email: 'bob@acme.com', city: 'Austin', dup: true },
  { n: 7, name: 'Dee Fox', email: 'dee@acme.com', city: 'Denver', dup: false },
]
const after = before.filter((r) => !r.dup)

const steps = [
  { t: 'Drop in your file', d: 'CSV, XLSX or XLS. It opens instantly in your browser tab. Pick a sheet if the workbook has several.' },
  { t: 'Choose what makes a duplicate', d: 'Tick one column (an email) or several (first name + last name + city). Decide about capitals, extra spaces and blank cells.' },
  { t: 'Review, then download', d: 'See every row that would be removed, with the one being kept beside it. Confirm, undo if you change your mind, then export CSV or XLSX.' },
]

const benefits = [
  { t: 'Private by design', d: 'There is no server to upload to. Your customer lists, invoices and exports are processed on your own computer and never leave it.' },
  { t: 'You see it before it happens', d: 'Nothing is deleted until you confirm. The exact rows to be removed are listed first, and every removal can be undone.' },
  { t: 'Exact control over “duplicate”', d: 'Match on any combination of columns, ignore case and spaces, choose how blanks behave, and keep the first or the last occurrence.' },
]

const useCases = [
  'Mailing lists and newsletter exports',
  'CRM and lead exports with repeat contacts',
  'Combined reports from several sources',
  'Product, SKU and inventory lists',
  'Survey and form responses submitted twice',
  'Invoice and transaction exports',
]

const faqs = [
  { q: 'Is my file uploaded anywhere?', a: 'No. CleanSheet runs entirely in your browser. The page also tells your browser to block all network requests, and you can check it yourself: open your browser’s developer tools, watch the Network tab, and clean a file. Nothing is sent after the page has loaded.' },
  { q: 'What files and sizes does it handle?', a: 'CSV, XLSX and XLS files up to 50 MB and 500,000 data rows. Very large files can take 10 seconds or more and need a lot of memory, because everything runs on your computer.' },
  { q: 'Will my formatting and formulas survive?', a: 'No. Exports contain values only. Colors, column widths, merged cells, charts and other sheets are not kept, and formulas are saved as their last calculated values. CleanSheet warns you next to the download buttons. Your original file is never modified.' },
  { q: 'How does it decide what a duplicate is?', a: 'Rows are duplicates when all the columns you tick have the same value. You choose whether capitals and leading/trailing spaces count, how blank cells are treated, and whether to keep the first or the last occurrence of each group.' },
  { q: 'Can I undo a mistake?', a: 'Yes. Nothing is removed until you confirm, and you can undo the last removal or reset to the original data at any time before downloading.' },
  { q: 'Does it change my data in other ways?', a: 'Only in one case: in a CSV export, text cells that begin with =, +, - or @ get a leading apostrophe so spreadsheet apps cannot run them as formulas. You are told how many cells were affected. Numbers and normal text are left alone.' },
  { q: 'What does it cost?', a: 'CleanSheet is free to use, with no sign-up. The source code is open under the MIT license.' },
]
</script>

<template>
  <div class="flex flex-col gap-20 sm:gap-24">
    <!-- Hero -->
    <section class="grid items-center gap-10 lg:grid-cols-2" aria-labelledby="hero-h">
      <div>
        <p class="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4" /></svg>
          Your files never leave your browser
        </p>
        <h1 id="hero-h" class="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Remove duplicate rows from CSV and Excel files
          <span class="text-indigo-600">without uploading them.</span>
        </h1>
        <p class="mt-5 max-w-xl text-lg text-slate-600">
          Choose the columns that define a duplicate, preview exactly which rows will be removed, and download a clean file in under a minute. Free, no sign-up, and your data stays on your computer.
        </p>
        <ul class="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-700">
          <li class="flex items-center gap-1.5"><span class="text-emerald-600" aria-hidden="true">✓</span> Free, no account</li>
          <li class="flex items-center gap-1.5"><span class="text-emerald-600" aria-hidden="true">✓</span> Nothing uploaded</li>
          <li class="flex items-center gap-1.5"><span class="text-emerald-600" aria-hidden="true">✓</span> Preview before removing</li>
          <li class="flex items-center gap-1.5"><span class="text-emerald-600" aria-hidden="true">✓</span> Open source</li>
        </ul>
        <p class="mt-6 text-sm"><a href="#how" class="font-semibold text-indigo-700 underline">See how it works ↓</a></p>
      </div>
      <div id="tool" class="scroll-mt-6">
        <slot name="dropzone" />
      </div>
    </section>

    <!-- Benefits -->
    <section aria-labelledby="why-h">
      <h2 id="why-h" class="text-center text-2xl font-bold sm:text-3xl">Cleaner data, without the risk</h2>
      <div class="mt-8 grid gap-5 md:grid-cols-3">
        <div v-for="b in benefits" :key="b.t" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold">{{ b.t }}</h3>
          <p class="mt-2 text-slate-600">{{ b.d }}</p>
        </div>
      </div>
    </section>

    <!-- Before / after -->
    <section aria-labelledby="ba-h">
      <h2 id="ba-h" class="text-center text-2xl font-bold sm:text-3xl">Before and after</h2>
      <p class="mx-auto mt-3 max-w-2xl text-center text-slate-600">
        Matching on <strong>Email</strong>, ignoring capitals and extra spaces, keeping the first occurrence: 6 rows become 4.
      </p>
      <div class="mt-8 grid gap-6 lg:grid-cols-2">
        <div class="min-w-0">
          <h3 class="mb-2 text-sm font-semibold text-slate-700">Before · 6 rows</h3>
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table class="min-w-full text-left text-sm">
              <caption class="sr-only">Example data before cleaning, with two duplicate rows marked</caption>
              <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr><th scope="col" class="px-3 py-2">Row</th><th scope="col" class="px-3 py-2">Name</th><th scope="col" class="px-3 py-2">Email</th><th scope="col" class="px-3 py-2">City</th><th scope="col" class="px-3 py-2"><span class="sr-only">Status</span></th></tr>
              </thead>
              <tbody>
                <tr v-for="r in before" :key="r.n" class="border-t border-slate-100" :class="r.dup ? 'bg-red-50' : ''">
                  <th scope="row" class="px-3 py-1.5 text-xs font-normal text-slate-500">{{ r.n }}</th>
                  <td class="px-3 py-1.5">{{ r.name }}</td>
                  <td class="whitespace-pre px-3 py-1.5">{{ r.email }}</td>
                  <td class="px-3 py-1.5">{{ r.city }}</td>
                  <td class="px-3 py-1.5"><span v-if="r.dup" class="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">Remove</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="min-w-0">
          <h3 class="mb-2 text-sm font-semibold text-slate-700">After · 4 rows</h3>
          <div class="overflow-x-auto rounded-xl border border-emerald-200 bg-white">
            <table class="min-w-full text-left text-sm">
              <caption class="sr-only">Example data after cleaning</caption>
              <thead class="bg-emerald-50 text-xs uppercase tracking-wide text-emerald-900">
                <tr><th scope="col" class="px-3 py-2">Name</th><th scope="col" class="px-3 py-2">Email</th><th scope="col" class="px-3 py-2">City</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in after" :key="r.n" class="border-t border-slate-100">
                  <td class="px-3 py-1.5">{{ r.name }}</td>
                  <td class="px-3 py-1.5">{{ r.email }}</td>
                  <td class="px-3 py-1.5">{{ r.city }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="scroll-mt-6" aria-labelledby="how-h">
      <h2 id="how-h" class="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
      <ol class="mt-8 grid gap-5 md:grid-cols-3">
        <li v-for="(s, i) in steps" :key="s.t" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white" aria-hidden="true">{{ i + 1 }}</span>
          <h3 class="mt-4 text-lg font-semibold"><span class="sr-only">Step {{ i + 1 }}: </span>{{ s.t }}</h3>
          <p class="mt-2 text-slate-600">{{ s.d }}</p>
        </li>
      </ol>
    </section>

    <!-- Use cases -->
    <section aria-labelledby="use-h">
      <h2 id="use-h" class="text-center text-2xl font-bold sm:text-3xl">Made for the files you work with every week</h2>
      <ul class="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
        <li v-for="u in useCases" :key="u" class="flex items-start gap-2 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
          <span class="mt-0.5 text-emerald-600" aria-hidden="true">✓</span><span>{{ u }}</span>
        </li>
      </ul>
    </section>

    <!-- Privacy -->
    <section class="rounded-3xl bg-slate-900 px-6 py-10 text-white sm:px-12" aria-labelledby="priv-h">
      <h2 id="priv-h" class="text-2xl font-bold sm:text-3xl">Don’t take our word for it. Check.</h2>
      <p class="mt-3 max-w-2xl text-slate-300">
        Most online spreadsheet tools send your file to a server. CleanSheet has no server for your data. Open your browser’s developer tools, switch to the Network tab and clean a file: you will see no upload. The site also ships a security policy that blocks network connections, and the full source code is public for anyone to inspect.
      </p>
      <p class="mt-5"><a :href="REPO" class="font-semibold text-indigo-300 underline" rel="noopener">Read the source code on GitHub →</a></p>
    </section>

    <!-- FAQ -->
    <section class="mx-auto w-full max-w-3xl" aria-labelledby="faq-h">
      <h2 id="faq-h" class="text-center text-2xl font-bold sm:text-3xl">Questions</h2>
      <div class="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        <details v-for="f in faqs" :key="f.q" class="group px-5 py-4">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
            {{ f.q }}
            <span class="text-slate-400 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <p class="mt-3 text-slate-600">{{ f.a }}</p>
        </details>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="text-center" aria-labelledby="cta-h">
      <h2 id="cta-h" class="text-2xl font-bold sm:text-3xl">Ready to clean a file?</h2>
      <p class="mt-2 text-slate-600">It takes less than a minute, and your data stays on your computer.</p>
      <a href="#tool" class="mt-5 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700">Choose a file</a>
    </section>
  </div>
</template>
