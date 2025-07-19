<script lang="ts">
  export let title: string;
  export let description: string;
</script>

<div class="panel">
  <div>
    <h2>{title}</h2>
    <div class="description">
      {description}
    </div>
  </div>

  <slot></slot>
</div>

<style>
  .panel {
    padding: 10px 24px;
  }
  .panel:hover {
    background-color: #252728;
  }

  .description {
    color: #cbcbcb;
    font-size: 14px;
  }

  h2 {
    font-size: 18px;
    color: #e7e7e7;
    margin-bottom: 0;
    margin-top: 10px;
  }
</style>
