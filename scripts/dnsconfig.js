var REG_NONE = NewRegistrar("none");
var DNS_PROVIDER = NewDnsProvider("dnspod");
var DOMAIN_NAME = "is-app.top";

function createSubdomainsObject(jsonsPath) {
  var domains = [];
  try {
    var jsons = glob.apply(null, [jsonsPath, true, ".json"]);

    for (var i = 0; i < jsons.length; i++) {
      try {
        domains.push({ data: require(jsons[i]) });
      } catch (e) {
        console.error("Error loading JSON file:", jsons[i], e);
      }
    }
  } catch (e) {
    console.error("Error finding JSON files:", jsonsPath, e);
  }

  return domains;
}

var subdomains = createSubdomainsObject('../domains');
var records = [];

for (var i = 0; i < subdomains.length; i++) {
  var subdomainData = subdomains[i].data;
  var subdomain = subdomainData.subdomain;

  if (subdomainData.records.A) {
    for (var ipv4 in subdomainData.records.A) {
      records.push(A(subdomain, subdomainData.records.A[ipv4]));
    }
  }

  if (subdomainData.records.AAAA) {
    for (var ipv6 in subdomainData.records.AAAA) {
      records.push(AAAA(subdomain, subdomainData.records.AAAA[ipv6]));
    }
  }

  if (subdomainData.records.CNAME) {
    records.push(CNAME(subdomain, subdomainData.records.CNAME + "."));
  }

  if (subdomainData.records.NS) {
    for (var ns in subdomainData.records.NS) {
      records.push(NS(subdomain, subdomainData.records.NS[ns] + "."));
    }
  }

  if (subdomainData.records.MX) {
    for (var mx in subdomainData.records.MX) {
      records.push(MX(subdomain, 20, subdomainData.records.MX[mx] + "."));
    }
  }

  if (subdomainData.records.TXT) {
    for (var txt in subdomainData.records.TXT) {
      records.push(TXT(subdomain, subdomainData.records.TXT[txt]));
    }
  }
}

D(DOMAIN_NAME, REG_NONE, DnsProvider(DNS_PROVIDER), records);
