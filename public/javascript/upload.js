const realFileBtn = document.getElementById("real-file");
const customBtn = document.getElementById("custom-button");
const customTxt = document.getElementById("custom-text");
const btn= document.getElementById("upload");
customBtn.addEventListener("click", function() {
  realFileBtn.click();
});

realFileBtn.addEventListener("change", function() {
  if (realFileBtn.value) {
    customTxt.innerHTML = realFileBtn.value.match(
      /[\/\\]([\w\d\s\.\-\(\)]+)$/
    )[1];
  } else {
    customTxt.innerHTML = "No file chosen, yet.";
  }
});

// btn.addEventListener("click",function(){
//   let sheet = document.getElementById("real-file").files[0];
//   let formData = new FormData();
//
//   formData.append("sheet", sheet);
//   fetch('http://localhost:4000/shop/stock/excel', {method: "POST", body: formData});
// });


