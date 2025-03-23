const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");

const app = express();
app.use(express.static("public"));

const APPSHEET_APP_ID = "bd6a433c-a1e1-4c83-bbcd-40608012d797";
const APPSHEET_API_KEY = "V2-TbDDk-gqtLj-KE9FY-xYqex-F2cVR-C0Llt-5dmIb-1Iq8m";

async function fetchERP(fromDate,toDate,type) {
  const key = type==="발주리스트"?"I7C239FA523A2458FF526A682DE34409C"
            : type==="출하양식"?"I9E9ABDE2060B4BF29914E821B9BEC261"
            : "I5ABFFDA8859145999A23F8D6751C34AA";
  const resp = await axios.post(`https://mes.jinhap.com/do?k=${key}`, { FROM_DATE:fromDate, TO_DATE:toDate });
  return resp.data.result.data.REQ || [];
}

async function upload(rows,type,clearExisting) {
  const table = type==="발주리스트"? "DB"
               : type==="출하양식"? "업로드"
               : "납품정보_진합";
  if(clearExisting) {
    await axios.post(
      `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${table}/Action`,
      { Action:"Delete", Properties:{Locale:"ko-KR"}, Rows:[] },
      { headers:{ ApplicationAccessKey:APPSHEET_API_KEY } }
    );
  }
  await axios.post(
    `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${table}/records`,
    { Action:"Add", Properties:{Locale:"ko-KR"}, Rows:rows },
    { headers:{ ApplicationAccessKey:APPSHEET_API_KEY } }
  );
}

app.get("/api/sync", async (req,res) => {
  const { fromDate,toDate,type,clear } = req.query;
  try {
    const rows = await fetchERP(fromDate,toDate,type);
    await upload(rows,type,clear==="true");
    const csv = new Parser().parse(rows);
    const filename = `sync_${Date.now()}.csv`;
    const filepath = path.join(__dirname,"public","downloads",filename);
    fs.writeFileSync(filepath,csv);
    res.json({ status:"OK", count:rows.length, download:`/downloads/${filename}` });
  }
  catch(err) {
    res.status(500).json({ status:"ERROR", message:err.message });
  }
});

app.listen(8080,()=> console.log("▶ Server running at http://localhost:8080"));
