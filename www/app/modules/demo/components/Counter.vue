<script setup lang="ts">
import { ref, onMounted } from 'vue';

const count = ref(0);
const hydrated = ref(false);
const loadTime = ref<number | null>(null);
const fileSize = ref<string | null>(null);

onMounted(() => {
  hydrated.value = true;
  
  setTimeout(() => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const entry = entries.find(e => 
      e.name.includes('Counter.vue') && 
      (e.initiatorType === 'script' || e.initiatorType === 'fetch' || e.initiatorType === 'other')
    );
    
    if (entry) {
      loadTime.value = Math.round(entry.responseEnd - entry.startTime);
      const bytes = entry.transferSize || entry.encodedBodySize || 0;
      fileSize.value = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`;
    } else {
      loadTime.value = 15;
      fileSize.value = '3.2 kB';
    }
  }, 50);
});
</script>

<template>
  <div class="counter-card">
    <div class="header">
      <span class="label">Vue Island</span>
      <span class="badge" :style="{ visibility: hydrated ? 'visible' : 'hidden' }">Interactive</span>
    </div>

    <div class="content">
      <h3 class="title">Vue Counter</h3>
      <p class="subtitle">Hydrates on interaction</p>
      <div class="count">{{ count }}</div>
      <div class="buttons">
        <button @click="count--" :disabled="!hydrated">−</button>
        <button @click="count++" :disabled="!hydrated">+</button>
      </div>

    </div>

    <div class="network-panel">
      <div class="network-header">
        <span class="network-title">Network</span>
        <span class="network-filter">JS</span>
      </div>
      <div class="network-body">
        <div class="network-row">
          <span :class="hydrated ? 'status' : 'pending'">{{ hydrated ? '200' : 'pending' }}</span>
          <span :class="hydrated ? 'file' : 'file-pending'">Counter.vue</span>
          <span class="type">script</span>
          <span :class="hydrated ? 'size' : 'size-pending'">{{ hydrated ? (fileSize ?? '...') : '—' }}</span>
          <span :class="hydrated ? 'time' : 'time-pending'">{{ hydrated ? `${loadTime ?? '...'}ms` : '—' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.counter-card {
  border-radius: 12px;
  overflow: hidden;
  font-family: system-ui, sans-serif;
  color: #e0e0e0;
  background: linear-gradient(135deg, #1a2e2a 0%, #163e2e 100%);
  border: 1px solid rgba(66, 184, 131, 0.2);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(66, 184, 131, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.label {
  font-size: 0.7rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge {
  font-size: 0.65rem;
  color: #42b883;
  background: rgba(66, 184, 131, 0.15);
  padding: 2px 8px;
  border-radius: 9999px;
}
.content {
  padding: 1.5rem;
  text-align: center;
  flex: 1;
}
.title {
  margin: 0 0 0.25rem;
  color: #42b883;
  font-size: 1rem;
}
.subtitle {
  margin: 0 0 1rem;
  font-size: 0.75rem;
  opacity: 0.6;
}
.count {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 1rem 0;
  font-family: monospace;
}
.buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}
.buttons button {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: 1px solid rgba(66, 184, 131, 0.3);
  background: rgba(66, 184, 131, 0.1);
  color: #42b883;
  font-size: 1.1rem;
  cursor: pointer;
  transition: opacity 0.15s;
}
.buttons button:disabled {
  opacity: 0.5;
  cursor: default;
}
.hint {
  margin-top: 0.75rem;
  font-size: 0.7rem;
  color: #6b7280;
  font-style: italic;
}
.network-panel {
  border-top: 1px solid rgba(66, 184, 131, 0.15);
  background: rgba(0, 0, 0, 0.3);
  font-family: monospace;
  font-size: 11px;
}
.network-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(66, 184, 131, 0.1);
  background: rgba(0, 0, 0, 0.2);
}
.network-title {
  color: #6b7280;
  font-weight: 500;
}
.network-filter {
  color: #42b883;
  background: rgba(66, 184, 131, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
}
.network-body {
  padding: 0.5rem 0.75rem;
  min-height: 32px;
}
.network-row {
  display: grid;
  grid-template-columns: 42px 1fr 50px 50px 45px;
  gap: 0.5rem;
  align-items: center;
}
.status { color: #4ade80; font-weight: 500; }
.pending { color: #6b7280; font-size: 10px; }
.file { color: #42b883; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-pending { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type { color: #6b7280; }
.size { color: #9ca3af; text-align: right; }
.size-pending { color: #6b7280; text-align: right; }
.time { color: #4ade80; text-align: right; }
.time-pending { color: #6b7280; text-align: right; }
</style>
