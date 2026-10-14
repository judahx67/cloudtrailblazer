// Keep page requests bounded and serialized; resets discard even uncancelable results.
export class ScrollPages {
  constructor(fetchPage, append, changed, size = 20) {
    this.fetchPage = fetchPage; this.append = append; this.changed = changed; this.size = size;
    this.generation = 0; this.reset();
  }

  reset() {
    this.generation++; this.offset = 0; this.total = null; this.loading = false; this.error = null;
  }

  async next() {
    if (this.loading || (this.total !== null && this.offset >= this.total)) return;
    const generation = this.generation, offset = this.offset;
    this.loading = true; this.error = null; this.changed();
    try {
      const page = await this.fetchPage(offset, this.size);
      if (generation !== this.generation) return;
      if (!page.items.length && page.total > offset) throw new Error("Identity page unavailable.");
      this.append(page.items);
      this.offset = offset + page.items.length; this.total = page.total;
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error;
    } finally {
      if (generation === this.generation) { this.loading = false; this.changed(); }
    }
  }
}
