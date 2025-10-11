<script>
  export let title = "Noname";
</script>

<div id="container" tabindex="-1">
  <span>{title}</span>
  <slot><div style="color: gray;" tabindex="-1">no content found.</div></slot>
</div>

<style>
  #container {
    padding-left: 10px;
    padding-bottom: 5px;
    padding-top: 5px;
    border-bottom: 1px solid #3e3e3e;
  }

  *:focus {
    outline: none;
  }
</style>
