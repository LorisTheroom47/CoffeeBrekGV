import {
  createProductOptionAction,
  createProductOptionGroupAction,
  deleteProductOptionAction,
  deleteProductOptionGroupAction,
  updateProductOptionAction,
  updateProductOptionGroupAction,
} from "@/app/admin/(protected)/piatti/[id]/modifica/product-option-actions";
import type { MenuItemProductOptionGroup } from "@/lib/menu";
import ProductOptionDeleteForm from "./ProductOptionDeleteForm";
import ProductOptionForm from "./ProductOptionForm";
import ProductOptionGroupForm from "./ProductOptionGroupForm";
import styles from "./AdminProductOptions.module.css";

type AdminProductOptionsPanelProps = Readonly<{
  groups: MenuItemProductOptionGroup[] | null;
  menuItemId: string;
  menuItemName: string;
}>;

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function selectionTypeLabel(selectionType: string): string {
  return selectionType === "SINGLE_REQUIRED"
    ? "Scelta singola obbligatoria"
    : "Scelta multipla facoltativa";
}

function priceForInput(price: number): string {
  return price.toFixed(2);
}

export default function AdminProductOptionsPanel({
  groups,
  menuItemId,
  menuItemName,
}: AdminProductOptionsPanelProps) {
  const createGroupAction = createProductOptionGroupAction.bind(
    null,
    menuItemId,
  );

  return (
    <section
      aria-labelledby="product-options-title"
      className="admin-form-card"
      id="product-options"
    >
      <div className={styles.sectionHeader}>
        <div>
          <p className="eyebrow">Configurazione del piatto</p>
          <h2 className="admin-form-title" id="product-options-title">
            Opzioni prodotto
          </h2>
          <p className={styles.intro}>
            Crea gruppi e opzioni specifici per <strong>{menuItemName}</strong>.
            I prezzi inseriti qui saranno verificati dal server al momento
            dell’ordine.
          </p>
        </div>
      </div>

      {groups === null ? (
        <div className="admin-form-empty" role="alert">
          <p>Non è stato possibile caricare le opzioni prodotto.</p>
          <p>Riprova più tardi.</p>
        </div>
      ) : (
        <div className={styles.content}>
          <details className={styles.editor}>
            <summary>Nuovo gruppo opzioni</summary>
            <div className={styles.editorBody}>
              <ProductOptionGroupForm
                action={createGroupAction}
                formId="new-product-option-group"
                initialValues={{
                  name: "",
                  selectionType: "MULTIPLE_OPTIONAL",
                  available: "true",
                  displayOrder: String(groups.length),
                }}
                submitLabel="Crea gruppo"
              />
            </div>
          </details>

          {groups.length === 0 ? (
            <div className={styles.empty} role="status">
              <p>Nessun gruppo configurato per questo piatto.</p>
              <p>Usa “Nuovo gruppo opzioni” per iniziare.</p>
            </div>
          ) : (
            <div className={styles.groupList}>
              {groups.map((group) => {
                const updateGroupAction = updateProductOptionGroupAction.bind(
                  null,
                  menuItemId,
                  group.id,
                );
                const deleteGroupAction = deleteProductOptionGroupAction.bind(
                  null,
                  menuItemId,
                  group.id,
                );
                const createOptionAction = createProductOptionAction.bind(
                  null,
                  menuItemId,
                  group.id,
                );
                const availableOptions = group.options.filter(
                  (option) => option.available,
                ).length;

                return (
                  <article className={styles.groupCard} key={group.id}>
                    <header className={styles.groupHeader}>
                      <div>
                        <h3>{group.name}</h3>
                        <div className={styles.meta}>
                          <span>{selectionTypeLabel(group.selectionType)}</span>
                          <span>
                            {group.available
                              ? "Gruppo disponibile"
                              : "Gruppo non disponibile"}
                          </span>
                          <span>Ordine {group.displayOrder}</span>
                        </div>
                      </div>
                      <ProductOptionDeleteForm
                        action={deleteGroupAction}
                        confirmationMessage={`Vuoi eliminare definitivamente il gruppo “${group.name}” e tutte le sue opzioni?`}
                        label="Elimina gruppo"
                      />
                    </header>

                    {group.available &&
                    group.selectionType === "SINGLE_REQUIRED" &&
                    availableOptions === 0 ? (
                      <p className={styles.warning} role="status">
                        Questo gruppo obbligatorio non ha opzioni disponibili:
                        il prodotto non sarà ordinabile finché non ne aggiungi
                        almeno una.
                      </p>
                    ) : null}

                    <details className={styles.editor}>
                      <summary>Modifica gruppo</summary>
                      <div className={styles.editorBody}>
                        <ProductOptionGroupForm
                          action={updateGroupAction}
                          formId={`edit-product-option-group-${group.id}`}
                          initialValues={{
                            name: group.name,
                            selectionType: group.selectionType,
                            available: group.available ? "true" : "false",
                            displayOrder: String(group.displayOrder),
                          }}
                          submitLabel="Salva gruppo"
                        />
                      </div>
                    </details>

                    <div className={styles.optionsSection}>
                      <div className={styles.optionsHeading}>
                        <h4>Opzioni</h4>
                        <span>{group.options.length}</span>
                      </div>

                      <details className={styles.editor}>
                        <summary>Aggiungi opzione</summary>
                        <div className={styles.editorBody}>
                          <ProductOptionForm
                            action={createOptionAction}
                            formId={`new-product-option-${group.id}`}
                            initialValues={{
                              name: "",
                              price: "0.00",
                              available: "true",
                              displayOrder: String(group.options.length),
                            }}
                            submitLabel="Aggiungi opzione"
                          />
                        </div>
                      </details>

                      {group.options.length === 0 ? (
                        <p className={styles.noOptions}>
                          Nessuna opzione presente in questo gruppo.
                        </p>
                      ) : (
                        <div className={styles.optionList}>
                          {group.options.map((option) => {
                            const updateOptionAction =
                              updateProductOptionAction.bind(
                                null,
                                menuItemId,
                                group.id,
                                option.id,
                              );
                            const deleteOptionAction =
                              deleteProductOptionAction.bind(
                                null,
                                menuItemId,
                                group.id,
                                option.id,
                              );

                            return (
                              <article
                                className={styles.optionCard}
                                key={option.id}
                              >
                                <div className={styles.optionSummary}>
                                  <div>
                                    <h5>{option.name}</h5>
                                    <div className={styles.meta}>
                                      <span>
                                        {currencyFormatter.format(option.price)}
                                      </span>
                                      <span>
                                        {option.available
                                          ? "Disponibile"
                                          : "Non disponibile"}
                                      </span>
                                      <span>Ordine {option.displayOrder}</span>
                                    </div>
                                  </div>
                                  <ProductOptionDeleteForm
                                    action={deleteOptionAction}
                                    confirmationMessage={`Vuoi eliminare definitivamente l’opzione “${option.name}”?`}
                                    label="Elimina opzione"
                                  />
                                </div>

                                <details className={styles.editor}>
                                  <summary>Modifica opzione</summary>
                                  <div className={styles.editorBody}>
                                    <ProductOptionForm
                                      action={updateOptionAction}
                                      formId={`edit-product-option-${option.id}`}
                                      initialValues={{
                                        name: option.name,
                                        price: priceForInput(option.price),
                                        available: option.available
                                          ? "true"
                                          : "false",
                                        displayOrder: String(
                                          option.displayOrder,
                                        ),
                                      }}
                                      submitLabel="Salva opzione"
                                    />
                                  </div>
                                </details>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
