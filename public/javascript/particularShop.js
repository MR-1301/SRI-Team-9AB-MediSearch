document.getElementById("myInput").addEventListener("keyup", function () {
  let filter = document.getElementById("myInput").value.toUpperCase();
  let myTable = document.getElementById("myTable");
  let tr = myTable.getElementsByTagName('tr');
  console.log(tr.length);
  for (var i = 0; i < tr.length; i++) {
    let td = tr[i].getElementsByTagName('td')[0];
    if (td) {
      let textvalue = td.textContent || td.innerHTML;
      if (textvalue.toUpperCase().indexOf(filter) > -1) {
        tr[i].style.display = "";
      } else {
        tr[i].style.display = "none";
      }
    }
  }
});

for (let i = 0; i < allMeds.length; i++) {
  var valueCount;
  
  function priceTotal() {
    const currPrice = parseInt(document.getElementById(`price${i + 1}`).innerText);
    var total = valueCount * currPrice;
    const inital=parseInt(document.getElementById(`total${i + 1}`).innerText);
    document.getElementById(`total${i + 1}`).innerText = JSON.stringify(total);
    const curr= parseInt(document.getElementById("finalTotal").innerText);
    document.getElementById("finalTotal").innerText=JSON.stringify(curr+total-inital);
  }
  
  //plus button
  const plusID = `plus${i + 1}`;
  const minusID = `minus${i + 1}`;
  const inputID = `input${i + 1}`;
  
  
  document.getElementById(minusID).setAttribute("disabled", "disabled");
  
  
  document.getElementById(plusID).addEventListener("click", function () {
    valueCount = document.getElementById(inputID).value;
    
    valueCount++;
    document.getElementById(inputID).value = valueCount;
    if(valueCount==parseInt(allMeds[i].quantity))
    {
      document.getElementById(plusID).setAttribute("disabled", "disabled");
    }
    
    if (valueCount >= 1) {
      document.getElementById(minusID).removeAttribute("disabled");
      document.getElementById(minusID).classList.remove("disabled")
    }
    
    priceTotal()
  })
  
  document.getElementById(minusID).addEventListener("click", function () {
    
    valueCount = document.getElementById(inputID).value;
    
    valueCount--;
    document.getElementById(inputID).value = valueCount;
    
    if(valueCount==parseInt(allMeds[i].quantity)-1)
    {
      document.getElementById(plusID).removeAttribute("disabled");
      document.getElementById(plusID).classList.remove("disabled")
    }
    
    if (valueCount == 0) {
      document.getElementById(minusID).setAttribute("disabled", "disabled")
    }
    
    priceTotal()
  })
  
}




