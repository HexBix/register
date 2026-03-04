var REG_NONE = NewRegistrar("none");
var DNS_PROVIDER = NewDnsProvider("dnspod");
var DOMAIN_NAME = "is-app.top";

function createSubdomainsObject(jsonsPath) {
  var domains = [];
  try {
    var jsons = glob(jsonsPath, true, ".json");
    for (var i = 0; i < jsons.length; i++) {
      domains.push({ data: require(jsons[i]) });
    }
  } catch (e) {
    console.error("Error loading JSON files:", e);
  }
  return domains;
}

var subdomains = createSubdomainsObject("../domains");
var records = [];

for (var i = 0; i < subdomains.length; i++) {
  var data = subdomains[i].data;
  var sub = data.subdomain;

  if (!data.records) continue;

  if (data.records.A) {
    data.records.A.forEach(function (ip) {
      records.push(A(sub, ip));
    });
  }

  if (data.records.AAAA) {
    data.records.AAAA.forEach(function (ip) {
      records.push(AAAA(sub, ip));
    });
  }

  if (data.records.CNAME) {
    records.push(CNAME(sub, data.records.CNAME + "."));
  }

  if (data.records.NS) {
    data.records.NS.forEach(function (ns) {
      records.push(NS(sub, ns + "."));
    });
  }

  if (data.records.MX) {
    data.records.MX.forEach(function (mx) {
      records.push(MX(sub, 20, mx + "."));
    });
  }

  if (data.records.TXT) {
    data.records.TXT.forEach(function (txt) {
      records.push(TXT(sub, txt));
    });
  }
}

D(DOMAIN_NAME, REG_NONE, DNS_PROVIDER, records);
