document.getElementById("myInput").addEventListener("keyup",function()
{
  let filter=document.getElementById("myInput").value.toUpperCase();
  let myTable=document.getElementById("myTable");
  let tr=myTable.getElementsByTagName('tr');
  console.log(tr.length);
  for(var i=0;i<tr.length;i++)
  {
    
    let td=tr[i].getElementsByTagName('td')[0];
    if(td)
    {
      let textvalue=td.textContent || td.innerHTML;
      if(textvalue.toUpperCase().indexOf(filter)==0)
      {
        tr[i].style.display="";
      }
      else
      {
        tr[i].style.display="none";
      }
    }
  }
});