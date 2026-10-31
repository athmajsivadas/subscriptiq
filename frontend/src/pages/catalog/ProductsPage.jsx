import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Plus, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

export const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [taxRules, setTaxRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [basePrice, setBasePrice] = useState("1000.00");
  const [taxRuleId, setTaxRuleId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Variant Modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [priceExtra, setPriceExtra] = useState("560.00");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, taxRes] = await Promise.all([
        client.get("/products"),
        client.get("/tax-rules"),
      ]);
      setProducts(prodRes.data || []);
      setTaxRules(taxRes.data || []);
      if (taxRes.data?.length > 0) {
        setTaxRuleId(taxRes.data[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.post("/products", {
        name,
        code,
        base_price: parseFloat(basePrice),
        default_tax_rule_id: taxRuleId ? parseInt(taxRuleId) : null,
        is_active: true,
      });
      setShowModal(false);
      setName("");
      setCode("");
      fetchData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVariant = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.post(`/products/${selectedProduct.id}/variants`, {
        name: variantName,
        sku: variantSku,
        price_extra: parseFloat(priceExtra),
        is_active: true,
      });
      setSelectedProduct(null);
      setVariantName("");
      setVariantSku("");
      fetchData();
    } catch (err) {
      alert("Error adding variant: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Products & Variants</h2>
          <p className="text-sm text-slate-500">
            Define products with base prices and Odoo variant price extras (e.g. +560)
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          No products found.
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-base text-slate-900">{p.name}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                      {p.code}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.is_active ? "Active" : "Archived"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Base Price: <strong className="text-slate-900">₹{parseFloat(p.base_price).toFixed(2)}</strong>{" "}
                    | Tax Rule:{" "}
                    {taxRules.find((t) => t.id === p.default_tax_rule_id)?.name || "Default/None"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProduct(p)}
                  className="text-xs font-semibold px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Variant
                </button>
              </div>

              {/* Variants sub-table */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Variants ({p.variants?.length || 0})
                </p>
                {p.variants && p.variants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {p.variants.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{v.name}</p>
                          <p className="text-slate-500 font-mono text-[11px]">{v.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            +₹{parseFloat(v.price_extra).toFixed(2)}
                          </p>
                          <p className="text-slate-500 text-[10px]">
                            Total: ₹{(parseFloat(p.base_price) + parseFloat(v.price_extra)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No variants created for this product yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Product</h3>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Server Standard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Code</label>
                  <input
                    type="text"
                    required
                    placeholder="PROD-CLOUD-STD"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Tax Rule</label>
                <select
                  value={taxRuleId}
                  onChange={(e) => setTaxRuleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">None / 0%</option>
                  {taxRules.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rate}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  {submitting ? "Saving..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Variant</h3>
            <p className="text-xs text-slate-500 mb-4">Adding variant to {selectedProduct.name}</p>
            <form onSubmit={handleAddVariant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Variant Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra RAM / High Performance"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="VAR-RAM-16"
                    value={variantSku}
                    onChange={(e) => setVariantSku(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price Extra (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={priceExtra}
                    onChange={(e) => setPriceExtra(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  {submitting ? "Adding..." : "Add Variant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
