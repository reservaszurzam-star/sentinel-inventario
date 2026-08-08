import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAppContext } from './AppContext';
import { supabase } from '../lib/supabase';

export type CartItem = {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  details: {
    model: string;
    color: string;
    size: string;
    locationName: string;
  };
};

interface CartContextType {
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  processCart: (contactId: string | null, reference: string) => Promise<{ success: boolean; error?: string }>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeBrand, addTransaction } = useAppContext();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: Omit<CartItem, 'id'>) => {
    // Si ya existe el mismo producto de la misma ubicación, sumamos cantidad
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId && i.locationId === item.locationId);
      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, { ...item, id: Math.random().toString(36).substring(7) }];
    });
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const clearCart = () => {
    setItems([]);
  };

  const processCart = async (contactId: string | null, reference: string) => {
    if (items.length === 0) return { success: false, error: 'Carrito vacío' };

    try {
      // Create transactions for each item using execute_transaction RPC
      for (const item of items) {
        const { error } = await supabase.rpc('execute_transaction', {
          p_brand: activeBrand,
          p_type: 'DISPATCH',
          p_product_id: item.productId,
          p_quantity: item.quantity,
          p_from_location_id: item.locationId,
          p_to_location_id: null,
          p_reference: reference || 'DESPACHO_MASIVO',
          p_user_name: currentUser.name,
          p_contact_id: contactId,
          p_signature: null,
          p_serial_number: null
        });

        if (error) {
          throw new Error(`Error en ${item.details.model}: ${error.message}`);
        }
        
        // Agregar a contexto local para UI
        addTransaction({
          brand: activeBrand,
          type: 'DISPATCH',
          productId: item.productId,
          quantity: item.quantity,
          fromLocationId: item.locationId,
          toLocationId: null,
          reference: reference || 'DESPACHO_MASIVO',
          userName: currentUser.name,
          contactId,
          forceNewEntry: true
        });
      }

      // Enviar correo si hay contacto
      if (contactId) {
        const { data: contact } = await supabase.from('contacts').select('*').eq('id', contactId).single();
        if (contact?.email) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch('https://mmzloslnassvzbyvkuiq.supabase.co/functions/v1/send-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({
                recipients: [{ name: contact.name, email: contact.email }],
                subject: `Resumen de Despacho Masivo - ${activeBrand}`,
                html: `
                  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-radius: 8px;">
                    <div style="text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 20px; margin-bottom: 20px;">
                      <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">${activeBrand}</h1>
                      <p style="margin: 5px 0 0; font-size: 12px; color: #666; text-transform: uppercase;">Ticket de Envío Logistic</p>
                    </div>
                    
                    <table style="width: 100%; margin-bottom: 25px; font-size: 14px;">
                      <tr>
                        <td style="padding-bottom: 10px; color: #666;">Referencia:</td>
                        <td style="padding-bottom: 10px; font-weight: bold; text-align: right;">${reference}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #666;">Destinatario:</td>
                        <td style="padding-bottom: 10px; font-weight: bold; text-align: right;">${contact.name}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #666;">Fecha:</td>
                        <td style="padding-bottom: 10px; font-weight: bold; text-align: right;">${new Date().toLocaleDateString()}</td>
                      </tr>
                    </table>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
                      <thead>
                        <tr style="background-color: #f8f9fa;">
                          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Producto</th>
                          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Cant</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${items.map(i => `
                          <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                              <strong>${i.details.model}</strong><br/>
                              <span style="font-size: 11px; color: #666;">Talla: ${i.details.size} | Color: ${i.details.color}</span>
                            </td>
                            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee; font-weight: bold;">
                              ${i.quantity}
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>

                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 4px;">
                      <p style="margin: 0; font-size: 12px; color: #666;">Total de Unidades: <strong style="color: #000; font-size: 14px;">${items.reduce((acc, i) => acc + i.quantity, 0)}</strong></p>
                    </div>

                    <div style="margin-top: 40px; text-align: center;">
                      <p style="font-size: 10px; color: #999; margin: 0;">Generado automáticamente por LogixZazu Logistics</p>
                      <p style="font-size: 10px; color: #999; margin: 5px 0 0;">Por favor firme de conformidad al recibir.</p>
                    </div>
                  </div>
                `
              })
            });
          } catch (e) {
            console.error('Error enviando correo de despacho:', e);
          }
        }
      }

      setItems([]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return (
    <CartContext.Provider value={{
      isScannerOpen, setIsScannerOpen,
      isCartOpen, setIsCartOpen,
      items, addItem, removeItem, updateQuantity, clearCart, processCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
};
